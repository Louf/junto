"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/service";
import { newToken } from "@/lib/ids";
import { sendSignupConfirmation, sendContributionReceipt } from "@/lib/email";
import { METHOD_LABELS, formatCents, isPaymentMethod } from "@/lib/payments";
import { appUrl } from "@/lib/env";
import { formatEventDate } from "@/lib/dates";
import { callerKey, hit, retryMessage } from "@/lib/rateLimit";
import { announceSheetChange } from "@/lib/sheetLive";
import {
  MAX_ROWS,
  cleanName,
  cleanNote,
  nameKey,
} from "@/lib/sheet";

const schema = z.object({
  job_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  note: z.string().max(500).optional().nullable(),
});

export type SignupState =
  | { ok: true }
  | { ok: false; error: string };

export async function claimSlot(
  _prev: SignupState | null,
  formData: FormData,
): Promise<SignupState> {
  const raw = {
    job_id: String(formData.get("job_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    note: String(formData.get("note") ?? "").trim() || null,
  };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Unauthenticated and public — throttle before doing any real work.
  const limited = await hit(await callerKey("signup"), 10, 60);
  if (!limited.ok) {
    return {
      ok: false,
      error: `Too many attempts. ${retryMessage(limited.retryAfterSeconds)}`,
    };
  }

  const supa = supabaseService();

  // Capacity check + event lookup.
  const { data: job, error: jobErr } = await supa
    .from("jobs")
    .select(
      "*, event:events(slug, name, cancelled_at, event_at, event_tz, location), signups:signups(id)",
    )
    .eq("id", parsed.data.job_id)
    .maybeSingle();
  if (jobErr || !job) return { ok: false, error: "Job not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const j = job as any;
  // The UI hides this, but a stale page could still post.
  if (j.event?.cancelled_at) {
    return { ok: false, error: "This event has been cancelled" };
  }
  if ((j.signups?.length ?? 0) >= j.capacity) {
    return { ok: false, error: "This job is already full" };
  }

  const cancel_token = newToken();
  const { error: insErr } = await supa.from("signups").insert({
    job_id: parsed.data.job_id,
    name: parsed.data.name,
    email: parsed.data.email,
    note: parsed.data.note,
    cancel_token,
  });
  if (insErr) {
    if (insErr.code === "23505") {
      return { ok: false, error: "You've already signed up for this job" };
    }
    return { ok: false, error: insErr.message };
  }

  const slug = j.event.slug;
  const shareUrl = `${appUrl()}/e/${slug}`;
  const cancelUrl = `${appUrl()}/cancel/${cancel_token}`;

  sendSignupConfirmation({
    to: parsed.data.email,
    participantName: parsed.data.name,
    eventName: j.event.name,
    jobTitle: j.title,
    shareUrl,
    cancelUrl,
    calendarUrl: `${shareUrl}/event.ics`,
    when: j.event.event_at
      ? formatEventDate(j.event.event_at, j.event.event_tz, "long")
      : undefined,
    location: j.event.location ?? null,
  }).catch((e) => console.error("signup email failed", e));

  revalidatePath(`/e/${slug}`);
  return { ok: true };
}

// =====================
// Fund contributions
// =====================

const pledgeSchema = z.object({
  fund_id: z.string().uuid(),
  name: z.string().min(1, "Add your name").max(120),
  // Required. Claiming a dessert slot already asks for an email; reporting a
  // payment carries higher stakes, and this is the only way to reach someone
  // if the event is called off after they've sent money.
  email: z.string().email("Add an email so we can reach you"),
  amount_cents: z
    .number()
    .int()
    .min(1, "Add the amount you sent")
    .max(100_000_00),
});

export type PledgeState = { ok: true } | { ok: false; error: string };

/**
 * Records that someone says they sent money. Junto has no way to verify this —
 * the organizer confirms it from the manage page once it lands.
 */
export async function pledgeContribution(
  _prev: PledgeState | null,
  formData: FormData,
): Promise<PledgeState> {
  const parsed = pledgeSchema.safeParse({
    fund_id: String(formData.get("fund_id") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    amount_cents: Number(formData.get("amount_cents") ?? 0),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const limited = await hit(await callerKey("pledge"), 10, 60);
  if (!limited.ok) {
    return {
      ok: false,
      error: `Too many attempts. ${retryMessage(limited.retryAfterSeconds)}`,
    };
  }

  const supa = supabaseService();

  const { data: fund, error: fundErr } = await supa
    .from("funds")
    .select(
      "id, recipient_name, method, event:events(slug, name, creator_email, cancelled_at)",
    )
    .eq("id", parsed.data.fund_id)
    .maybeSingle();
  if (fundErr || !fund) return { ok: false, error: "Fund not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const f = fund as any;
  const method = String(f.method ?? "");
  if (f.event?.cancelled_at) {
    return { ok: false, error: "This event has been cancelled" };
  }

  // Guard against a double submit or a refresh replaying the action. A hard
  // unique constraint would be wrong — in goal mode the same person may
  // legitimately chip in twice — so this only collapses an identical repeat
  // within a short window.
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: recent } = await supa
    .from("contributions")
    .select("id")
    .eq("fund_id", parsed.data.fund_id)
    .eq("email", parsed.data.email)
    .eq("amount_cents", parsed.data.amount_cents)
    .gte("created_at", since)
    .maybeSingle();

  if (recent) {
    // Already recorded moments ago — treat as success rather than doubling it.
    const slugNow = f.event?.slug as string | undefined;
    if (slugNow) revalidatePath(`/e/${slugNow}`);
    return { ok: true };
  }

  const { error: insErr } = await supa.from("contributions").insert({
    fund_id: parsed.data.fund_id,
    name: parsed.data.name,
    email: parsed.data.email,
    amount_cents: parsed.data.amount_cents,
  });
  if (insErr) return { ok: false, error: "Could not record that payment" };

  const slug = f.event?.slug as string | undefined;
  if (slug) revalidatePath(`/e/${slug}`);

  // Fire and forget — a failed receipt shouldn't discard a recorded payment.
  if (slug) {
    sendContributionReceipt({
      to: parsed.data.email,
      contributorName: parsed.data.name,
      eventName: f.event?.name ?? "the event",
      amount: formatCents(parsed.data.amount_cents),
      recipientName: f.recipient_name,
      methodLabel: isPaymentMethod(method) ? METHOD_LABELS[method] : method,
      shareUrl: `${appUrl()}/e/${slug}`,
      organizerEmail: f.event?.creator_email ?? "",
    }).catch((e) => console.error("receipt email failed", e));
  }

  return { ok: true };
}

// =====================
// Contribution sheet
// =====================

export type SheetResult = { ok: true } | { ok: false; error: string };

const uuid = z.string().uuid();

type SheetEvent = { id: string; slug: string; kind: string; cancelled_at: string | null };

/** Loads the event a sheet row belongs to, if it's an open sheet. */
async function openSheetForRow(
  rowId: string,
): Promise<{ ev: SheetEvent } | { error: string }> {
  const supa = supabaseService();
  const { data } = await supa
    .from("sheet_rows")
    .select("id, event:events(id, slug, kind, cancelled_at)")
    .eq("id", rowId)
    .maybeSingle();
  const ev = (data?.event ?? null) as SheetEvent | null;
  if (!ev || ev.kind !== "sheet") return { error: "That name isn't on this sheet" };
  // The UI hides the boxes, but a stale page could still post.
  if (ev.cancelled_at) return { error: "This event has been cancelled" };
  return { ev };
}

async function throttle(scope: string, limit: number, windowSeconds: number) {
  const limited = await hit(await callerKey(scope), limit, windowSeconds);
  return limited.ok
    ? null
    : `Too many changes. ${retryMessage(limited.retryAfterSeconds)}`;
}

/**
 * Ticks or unticks one box. Anyone with the link can do this for any row —
 * the same trust as a paper sheet — so it's throttled but not authorized.
 */
export async function setTick(
  rowId: string,
  columnId: string,
  ticked: boolean,
): Promise<SheetResult> {
  if (!uuid.safeParse(rowId).success || !uuid.safeParse(columnId).success) {
    return { ok: false, error: "Invalid request" };
  }

  // Generous: someone filling in a whole row taps several boxes in a row.
  const slow = await throttle("sheet-tick", 60, 60);
  if (slow) return { ok: false, error: slow };

  const found = await openSheetForRow(rowId);
  if ("error" in found) return { ok: false, error: found.error };

  const supa = supabaseService();
  const { data: column } = await supa
    .from("sheet_columns")
    .select("event_id")
    .eq("id", columnId)
    .maybeSingle();
  if (column?.event_id !== found.ev.id) {
    return { ok: false, error: "That column isn't on this sheet" };
  }

  const { error } = ticked
    ? await supa
        .from("sheet_ticks")
        .upsert(
          { row_id: rowId, column_id: columnId },
          { onConflict: "row_id,column_id", ignoreDuplicates: true },
        )
    : await supa
        .from("sheet_ticks")
        .delete()
        .eq("row_id", rowId)
        .eq("column_id", columnId);
  if (error) return { ok: false, error: "Couldn't save that. Try again." };

  revalidatePath(`/e/${found.ev.slug}`);
  announceSheetChange(found.ev.id);
  return { ok: true };
}

export async function setRowNote(
  rowId: string,
  note: string,
): Promise<SheetResult> {
  if (!uuid.safeParse(rowId).success) {
    return { ok: false, error: "Invalid request" };
  }

  const slow = await throttle("sheet-note", 20, 60);
  if (slow) return { ok: false, error: slow };

  const found = await openSheetForRow(rowId);
  if ("error" in found) return { ok: false, error: found.error };

  const supa = supabaseService();
  const { error } = await supa
    .from("sheet_rows")
    .update({ note: cleanNote(note) })
    .eq("id", rowId);
  if (error) return { ok: false, error: "Couldn't save your note. Try again." };

  revalidatePath(`/e/${found.ev.slug}`);
  announceSheetChange(found.ev.id);
  return { ok: true };
}

/** Someone who isn't on the list adds themselves, with their ticks and note. */
export async function addSheetRow(
  eventId: string,
  input: { name: string; note: string; columnIds: string[] },
): Promise<SheetResult> {
  if (!uuid.safeParse(eventId).success) {
    return { ok: false, error: "Invalid request" };
  }
  const name = cleanName(input.name);
  if (!name) return { ok: false, error: "Add your name" };

  // Stricter than ticking: each call grows the sheet.
  const slow = await throttle("sheet-add", 5, 600);
  if (slow) return { ok: false, error: slow };

  const supa = supabaseService();
  const { data: ev } = await supa
    .from("events")
    .select("id, slug, kind, cancelled_at, sheet_rows(name, sort_order), sheet_columns(id)")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || ev.kind !== "sheet") return { ok: false, error: "Sheet not found" };
  if (ev.cancelled_at) return { ok: false, error: "This event has been cancelled" };

  const rows = ev.sheet_rows ?? [];
  if (rows.length >= MAX_ROWS) {
    return { ok: false, error: "This sheet is full. Ask the organizer to add you." };
  }
  const already = rows.find((r) => nameKey(r.name) === nameKey(name));
  if (already) {
    return {
      ok: false,
      error: `${already.name} is already on the sheet. Find the name above and tick there.`,
    };
  }

  const nextSort = rows.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1;
  const { data: row, error } = await supa
    .from("sheet_rows")
    .insert({
      event_id: ev.id,
      name,
      note: cleanNote(input.note),
      self_added: true,
      sort_order: nextSort,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: "Couldn't add you. Try again." };

  // Only columns that really belong to this sheet.
  const valid = new Set((ev.sheet_columns ?? []).map((c) => c.id));
  const ticks = [...new Set(input.columnIds)]
    .filter((id) => valid.has(id))
    .map((column_id) => ({ row_id: row.id, column_id }));
  if (ticks.length > 0) {
    const { error: tickErr } = await supa.from("sheet_ticks").insert(ticks);
    if (tickErr) console.error("sheet ticks insert failed", tickErr);
  }

  revalidatePath(`/e/${ev.slug}`);
  announceSheetChange(ev.id);
  return { ok: true };
}
