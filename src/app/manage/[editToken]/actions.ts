"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/service";
import { newSlug, newToken } from "@/lib/ids";
import { getEventByEditToken } from "@/lib/events";
import { sendEventCancelled, type CancelRecipient } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { DEFAULT_DURATION_MINUTES, isValidZone } from "@/lib/dates";
import {
  FUND_MODES,
  PAYMENT_METHODS,
  METHOD_LABELS,
  hasFixedShare,
  isFundMode,
  isPaymentMethod,
  isValidHandle,
  normalizeHandle,
  parseAmountToCents,
} from "@/lib/payments";

async function eventForToken(token: string) {
  const supa = supabaseService();
  const { data } = await supa
    .from("events")
    .select("id, slug, banner_path")
    .eq("edit_token", token)
    .maybeSingle();
  return data as
    | { id: string; slug: string; banner_path: string | null }
    | null;
}

const updateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  event_at: z.string().min(1),
});

export async function updateEvent(token: string, formData: FormData) {
  const ev = await eventForToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;

  const parsed = updateSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    event_at: String(formData.get("event_at") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" } as const;
  }

  const supa = supabaseService();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = {
    name: parsed.data.name,
    description: parsed.data.description,
    event_at: new Date(parsed.data.event_at).toISOString(),
  };

  const rawTz = String(formData.get("event_tz") ?? "").trim();
  if (rawTz && isValidZone(rawTz)) patch.event_tz = rawTz;

  patch.location =
    String(formData.get("location") ?? "").trim().slice(0, 200) || null;

  const rawDuration = Number(formData.get("duration_minutes") ?? 0);
  patch.duration_minutes =
    Number.isInteger(rawDuration) && rawDuration > 0 && rawDuration <= 24 * 60
      ? rawDuration
      : DEFAULT_DURATION_MINUTES;

  const banner = formData.get("banner");
  if (banner && banner instanceof File && banner.size > 0) {
    if (banner.size > 5 * 1024 * 1024) {
      return { ok: false, error: "Banner must be under 5 MB" } as const;
    }
    const ext = (banner.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    const path = `${newToken()}.${ext}`;
    const bytes = new Uint8Array(await banner.arrayBuffer());
    const { error: upErr } = await supa.storage
      .from("event-banners")
      .upload(path, bytes, {
        contentType: banner.type || "image/jpeg",
        upsert: false,
      });
    if (upErr) return { ok: false, error: `Banner upload failed: ${upErr.message}` } as const;
    patch.banner_path = path;
    if (ev.banner_path) {
      await supa.storage
        .from("event-banners")
        .remove([ev.banner_path])
        .catch(() => undefined);
    }
  }

  const { error } = await supa.from("events").update(patch).eq("id", ev.id);
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath(`/manage/${token}`);
  revalidatePath(`/e/${ev.slug}`);
  return { ok: true } as const;
}

const addJobSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(500),
});

export async function addJob(token: string, formData: FormData) {
  const ev = await eventForToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;
  const parsed = addJobSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    capacity: formData.get("capacity"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" } as const;
  }
  const supa = supabaseService();
  const { data: maxRow } = await supa
    .from("jobs")
    .select("sort_order")
    .eq("event_id", ev.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;
  const { error } = await supa.from("jobs").insert({
    event_id: ev.id,
    title: parsed.data.title,
    description: parsed.data.description,
    capacity: parsed.data.capacity,
    sort_order: nextSort,
  });
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath(`/manage/${token}`);
  revalidatePath(`/e/${ev.slug}`);
  return { ok: true } as const;
}

export async function removeJob(token: string, jobId: string) {
  const ev = await eventForToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;
  const supa = supabaseService();
  const { error } = await supa
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("event_id", ev.id);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath(`/manage/${token}`);
  revalidatePath(`/e/${ev.slug}`);
  return { ok: true } as const;
}

export async function removeSignup(token: string, signupId: string) {
  const ev = await eventForToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;
  const supa = supabaseService();
  // Verify the signup belongs to a job in this event.
  const { data: signup } = await supa
    .from("signups")
    .select("id, job:jobs(event_id)")
    .eq("id", signupId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = signup as any;
  if (!s || s.job?.event_id !== ev.id) {
    return { ok: false, error: "Not found" } as const;
  }
  const { error } = await supa.from("signups").delete().eq("id", signupId);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath(`/manage/${token}`);
  revalidatePath(`/e/${ev.slug}`);
  return { ok: true } as const;
}

// =====================
// Fund
// =====================

const fundSchema = z.object({
  mode: z.enum(FUND_MODES),
  recipient_name: z.string().min(1, "Who's collecting the money?").max(120),
  // Nullable: the organizer may not know the figures yet.
  total_cents: z.number().int().min(1).nullable(),
  share_cents: z.number().int().min(1).nullable(),
  headcount: z.number().int().min(1).nullable(),
  method: z.enum(PAYMENT_METHODS),
  handle: z.string().min(1, "Add your payment handle"),
  note: z.string().max(200).optional().nullable(),
});

export async function saveFund(token: string, formData: FormData) {
  const ev = await eventForToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;

  const method = String(formData.get("method") ?? "");
  if (!isPaymentMethod(method)) {
    return { ok: false, error: "Pick a payment method" } as const;
  }

  const handle = normalizeHandle(method, String(formData.get("handle") ?? ""));
  if (!isValidHandle(method, handle)) {
    return {
      ok: false,
      error: `That doesn't look like a ${METHOD_LABELS[method]} handle`,
    } as const;
  }

  const mode = String(formData.get("mode") ?? "reimburse");
  if (!isFundMode(mode)) {
    return { ok: false, error: "Pick how you're collecting" } as const;
  }

  const totalRaw = String(formData.get("total") ?? "").trim();
  const shareRaw = String(formData.get("share") ?? "").trim();
  const headRaw = String(formData.get("headcount") ?? "").trim();
  let total = totalRaw ? parseAmountToCents(totalRaw) : null;
  const share = shareRaw ? parseAmountToCents(shareRaw) : null;
  const headcount = headRaw ? Number(headRaw) : null;

  if (totalRaw && total === null) {
    return { ok: false, error: "That total doesn't look like an amount" } as const;
  }
  if (shareRaw && share === null) {
    return { ok: false, error: "That share doesn't look like an amount" } as const;
  }
  if (headRaw && (!Number.isInteger(headcount) || (headcount ?? 0) < 1)) {
    return { ok: false, error: "How many people are splitting it?" } as const;
  }

  // Split mode derives its total from the share and the headcount, so the
  // organizer only enters the two numbers they actually know.
  if (mode === "split" && share !== null && headcount !== null) {
    total = share * headcount;
  }
  if (hasFixedShare(mode) && total !== null && share !== null && share > total) {
    return { ok: false, error: "A share can't exceed the total" } as const;
  }

  const parsed = fundSchema.safeParse({
    mode,
    recipient_name: String(formData.get("recipient_name") ?? "").trim(),
    total_cents: total,
    // Only split fixes a per-person amount; elsewhere payers choose.
    share_cents: hasFixedShare(mode) ? share : null,
    headcount: mode === "split" ? headcount : null,
    method,
    handle,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    } as const;
  }

  const supa = supabaseService();
  const { error } = await supa
    .from("funds")
    .upsert(
      { event_id: ev.id, ...parsed.data },
      { onConflict: "event_id" },
    );
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath(`/manage/${token}`);
  revalidatePath(`/e/${ev.slug}`);
  return { ok: true } as const;
}

export async function removeFund(token: string) {
  const ev = await eventForToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;
  const supa = supabaseService();
  const { error } = await supa.from("funds").delete().eq("event_id", ev.id);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath(`/manage/${token}`);
  revalidatePath(`/e/${ev.slug}`);
  return { ok: true } as const;
}

/** Verifies a contribution belongs to this event's fund before touching it. */
async function contributionInEvent(contributionId: string, eventId: string) {
  const supa = supabaseService();
  const { data } = await supa
    .from("contributions")
    .select("id, fund:funds(event_id)")
    .eq("id", contributionId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = data as any;
  return c && c.fund?.event_id === eventId ? c : null;
}

export async function confirmContribution(token: string, contributionId: string) {
  const ev = await eventForToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;
  if (!(await contributionInEvent(contributionId, ev.id))) {
    return { ok: false, error: "Not found" } as const;
  }
  const supa = supabaseService();
  const { error } = await supa
    .from("contributions")
    .update({ status: "confirmed" })
    .eq("id", contributionId);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath(`/manage/${token}`);
  revalidatePath(`/e/${ev.slug}`);
  return { ok: true } as const;
}

export async function removeContribution(token: string, contributionId: string) {
  const ev = await eventForToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;
  if (!(await contributionInEvent(contributionId, ev.id))) {
    return { ok: false, error: "Not found" } as const;
  }
  const supa = supabaseService();
  const { error } = await supa
    .from("contributions")
    .delete()
    .eq("id", contributionId);
  if (error) return { ok: false, error: error.message } as const;
  revalidatePath(`/manage/${token}`);
  revalidatePath(`/e/${ev.slug}`);
  return { ok: true } as const;
}

// =====================
// Cancellation
// =====================

/**
 * Marks an event cancelled rather than deleting it. Anyone who already sent
 * money needs the page to still resolve — a 404 tells them nothing and leaves
 * them no way to find out what happened or who to ask.
 */
export async function cancelEvent(token: string, formData: FormData) {
  const ev = await getEventByEditToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || null;
  // Only notify on the transition into cancelled, so cancel → restore →
  // cancel doesn't spam everyone twice.
  const alreadyCancelled = Boolean(ev.cancelled_at);

  const supa = supabaseService();
  const { error } = await supa
    .from("events")
    .update({ cancelled_at: new Date().toISOString(), cancel_reason: reason })
    .eq("id", ev.id);
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath(`/manage/${token}`);
  revalidatePath(`/e/${ev.slug}`);

  if (alreadyCancelled) return { ok: true, sent: 0, failed: 0 } as const;

  // One message per person, not per slot claimed. Anyone who both signed up
  // and sent money gets the money version, since it carries more.
  const byEmail = new Map<string, CancelRecipient>();
  for (const job of ev.jobs) {
    for (const s of job.signups) {
      const key = s.email.toLowerCase();
      if (!byEmail.has(key)) {
        byEmail.set(key, { email: s.email, name: s.name, contributed: false });
      }
    }
  }
  for (const c of ev.fund?.contributions ?? []) {
    if (!c.email) continue;
    const key = c.email.toLowerCase();
    const existing = byEmail.get(key);
    if (existing) existing.contributed = true;
    else byEmail.set(key, { email: c.email, name: c.name, contributed: true });
  }

  // Awaited rather than fire-and-forget: the organizer is told how many
  // people were actually reached, so a failure isn't silent.
  const { sent, failed } = await sendEventCancelled({
    recipients: [...byEmail.values()],
    eventName: ev.name,
    reason,
    organizerEmail: ev.creator_email,
    shareUrl: `${appUrl()}/e/${ev.slug}`,
  });

  return { ok: true, sent, failed } as const;
}

/** Cancelling by mistake shouldn't be a one-way door. */
export async function restoreEvent(token: string) {
  const ev = await eventForToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;

  const supa = supabaseService();
  const { error } = await supa
    .from("events")
    .update({ cancelled_at: null, cancel_reason: null })
    .eq("id", ev.id);
  if (error) return { ok: false, error: error.message } as const;

  revalidatePath(`/manage/${token}`);
  revalidatePath(`/e/${ev.slug}`);
  return { ok: true } as const;
}

// =====================
// Duplicate
// =====================

/**
 * Starts a fresh event from this one.
 *
 * Copies the shape of the event — name, description, location, duration, jobs
 * and where money goes — and deliberately leaves behind everything that
 * belonged to the last occurrence: signups, contributions, the fund's amounts,
 * and any cancellation.
 *
 * The banner isn't copied either. Two events pointing at one storage object
 * means deleting one could break the other, and re-uploading is cheap.
 */
export async function duplicateEvent(token: string, formData: FormData) {
  const ev = await getEventByEditToken(token);
  if (!ev) return { ok: false, error: "Invalid link" } as const;

  const eventAtRaw = String(formData.get("event_at") ?? "");
  const when = new Date(eventAtRaw);
  if (!eventAtRaw || Number.isNaN(when.getTime())) {
    return { ok: false, error: "Pick a date and time for the new event" } as const;
  }

  const rawTz = String(formData.get("event_tz") ?? "").trim();
  const event_tz = rawTz && isValidZone(rawTz) ? rawTz : ev.event_tz;

  const supa = supabaseService();

  let slug = newSlug();
  {
    const { data: existing } = await supa
      .from("events")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) slug = newSlug();
  }
  const edit_token = newToken();

  const { data: created, error: insertErr } = await supa
    .from("events")
    .insert({
      name: ev.name,
      description: ev.description,
      location: ev.location,
      duration_minutes: ev.duration_minutes,
      event_at: when.toISOString(),
      event_tz,
      creator_email: ev.creator_email,
      creator_user_id: ev.creator_user_id,
      edit_token,
      slug,
    })
    .select("id")
    .single();

  if (insertErr || !created) {
    return {
      ok: false,
      error: insertErr?.message ?? "Could not duplicate this event",
    } as const;
  }

  if (ev.jobs.length > 0) {
    const { error: jobsErr } = await supa.from("jobs").insert(
      ev.jobs.map((j, i) => ({
        event_id: created.id,
        title: j.title,
        description: j.description,
        capacity: j.capacity,
        sort_order: i,
      })),
    );
    if (jobsErr) {
      await supa.from("events").delete().eq("id", created.id);
      return { ok: false, error: `Could not copy jobs: ${jobsErr.message}` } as const;
    }
  }

  // Where the money goes carries over; what it cost last time does not.
  if (ev.fund) {
    const { error: fundErr } = await supa.from("funds").insert({
      event_id: created.id,
      mode: ev.fund.mode,
      recipient_name: ev.fund.recipient_name,
      method: ev.fund.method,
      handle: ev.fund.handle,
      note: ev.fund.note,
      total_cents: null,
      share_cents: null,
      headcount: null,
    });
    if (fundErr) console.error("fund copy failed", fundErr);
  }

  return { ok: true, editToken: edit_token } as const;
}
