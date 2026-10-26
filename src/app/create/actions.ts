"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { newSlug, newToken } from "@/lib/ids";
import { sendCreatorWelcome } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { DEFAULT_DURATION_MINUTES, isValidZone } from "@/lib/dates";
import {
  METHOD_LABELS,
  hasFixedShare,
  isFundMode,
  isPaymentMethod,
  isValidHandle,
  normalizeHandle,
  parseAmountToCents,
} from "@/lib/payments";
import { MAX_ROWS, parseColumns, parseNames } from "@/lib/sheet";

const jobSchema = z.object({
  title: z.string().min(1, "Job needs a title").max(120),
  description: z.string().max(1000).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(500),
});

const formSchema = z.object({
  name: z.string().min(1, "Add an event name").max(120),
  description: z.string().max(2000).optional().nullable(),
  event_at: z.string().min(1, "Pick a date and time"),
  creator_email: z.string().email("That email doesn't look right"),
});

const jobsSchema = z.array(jobSchema).min(1, "Add at least one job");

export type CreateState =
  | { ok: false; error: string }
  | { ok: true };

export async function createEvent(_prev: unknown, formData: FormData): Promise<CreateState> {
  // Signed in: the account owns the event and its email is the creator email,
  // whatever the form says.
  const {
    data: { user },
  } = await (await createSupabaseServerClient()).auth.getUser();

  const raw = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    event_at: String(formData.get("event_at") ?? ""),
    creator_email:
      user?.email ??
      String(formData.get("creator_email") ?? "").trim().toLowerCase(),
  };

  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  // A slots event needs jobs; a sheet needs columns and, usually, names.
  const kind = String(formData.get("kind") ?? "") === "sheet" ? "sheet" : "slots";
  let jobs: z.infer<typeof jobsSchema> = [];
  let columns: string[] = [];
  let names: string[] = [];

  if (kind === "slots") {
    const parsedJobs = jobsSchema.safeParse(
      JSON.parse(String(formData.get("jobs") ?? "[]")),
    );
    if (!parsedJobs.success) {
      return { ok: false, error: parsedJobs.error.issues[0]?.message ?? "Invalid jobs" };
    }
    jobs = parsedJobs.data;
  } else {
    const parsedColumns = parseColumns(
      JSON.parse(String(formData.get("columns") ?? "[]")),
    );
    if (!parsedColumns.ok) return { ok: false, error: parsedColumns.error };
    columns = parsedColumns.labels;

    names = parseNames(String(formData.get("names") ?? ""));
    if (names.length > MAX_ROWS) {
      return { ok: false, error: `Up to ${MAX_ROWS} names per sheet` };
    }
  }

  const eventAtIso = new Date(data.event_at).toISOString();

  // Ignore anything the runtime can't resolve rather than storing a zone that
  // will throw at format time.
  const rawTz = String(formData.get("event_tz") ?? "").trim();
  const event_tz = rawTz && isValidZone(rawTz) ? rawTz : null;

  const location = String(formData.get("location") ?? "").trim().slice(0, 200) || null;
  const rawDuration = Number(formData.get("duration_minutes") ?? 0);
  const duration_minutes =
    Number.isInteger(rawDuration) && rawDuration > 0 && rawDuration <= 24 * 60
      ? rawDuration
      : DEFAULT_DURATION_MINUTES;

  const supa = supabaseService();

  // Handle banner upload
  let banner_path: string | null = null;
  const banner = formData.get("banner");
  if (banner && banner instanceof File && banner.size > 0) {
    if (banner.size > 5 * 1024 * 1024) {
      return { ok: false, error: "Banner must be under 5 MB" };
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
    if (upErr) return { ok: false, error: `Banner upload failed: ${upErr.message}` };
    banner_path = path;
  }

  // Generate ids
  let slug = newSlug();
  // Very small chance of collision — retry once.
  {
    const { data: existing } = await supa
      .from("events")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) slug = newSlug();
  }
  const edit_token = newToken();

  const { data: event, error: insertErr } = await supa
    .from("events")
    .insert({
      kind,
      name: data.name,
      description: data.description,
      event_at: eventAtIso,
      event_tz,
      location,
      duration_minutes,
      banner_path,
      creator_email: data.creator_email,
      creator_user_id: user?.id ?? null,
      edit_token,
      slug,
    })
    .select("*")
    .single();
  if (insertErr || !event) {
    return { ok: false, error: insertErr?.message ?? "Could not create event" };
  }

  if (kind === "slots") {
    const jobRows = jobs.map((j, i) => ({
      event_id: event.id,
      title: j.title,
      description: j.description ?? null,
      capacity: j.capacity,
      sort_order: i,
    }));
    const { error: jobsErr } = await supa.from("jobs").insert(jobRows);
    if (jobsErr) {
      await supa.from("events").delete().eq("id", event.id);
      return { ok: false, error: `Could not save jobs: ${jobsErr.message}` };
    }
  } else {
    const { error: colErr } = await supa.from("sheet_columns").insert(
      columns.map((label, i) => ({ event_id: event.id, label, sort_order: i })),
    );
    const { error: rowErr } =
      names.length > 0
        ? await supa.from("sheet_rows").insert(
            names.map((name, i) => ({ event_id: event.id, name, sort_order: i })),
          )
        : { error: null };
    if (colErr || rowErr) {
      await supa.from("events").delete().eq("id", event.id);
      return {
        ok: false,
        error: `Could not save the sheet: ${(colErr ?? rowErr)?.message}`,
      };
    }
  }

  // Optional fund. Amounts may be blank — the organizer can add them later,
  // and the public pay card stays hidden until they do.
  if (kind === "slots" && String(formData.get("fund_enabled") ?? "") === "1") {
    const method = String(formData.get("fund_method") ?? "");
    if (!isPaymentMethod(method)) {
      return { ok: false, error: "Pick a payment method for the fund" };
    }

    const handle = normalizeHandle(
      method,
      String(formData.get("fund_handle") ?? ""),
    );
    if (!isValidHandle(method, handle)) {
      return {
        ok: false,
        error: `That doesn't look like a ${METHOD_LABELS[method]} handle`,
      };
    }

    const mode = String(formData.get("fund_mode") ?? "reimburse");
    if (!isFundMode(mode)) {
      return { ok: false, error: "Pick how you're collecting" };
    }

    const recipientName = String(
      formData.get("fund_recipient_name") ?? "",
    ).trim();
    if (!recipientName) {
      return { ok: false, error: "Who's collecting the money?" };
    }

    const totalRaw = String(formData.get("fund_total") ?? "").trim();
    const shareRaw = String(formData.get("fund_share") ?? "").trim();
    const headRaw = String(formData.get("fund_headcount") ?? "").trim();
    let total = totalRaw ? parseAmountToCents(totalRaw) : null;
    const share = shareRaw ? parseAmountToCents(shareRaw) : null;
    const headcount = headRaw ? Number(headRaw) : null;

    if (totalRaw && total === null) {
      return { ok: false, error: "That total doesn't look like an amount" };
    }
    if (shareRaw && share === null) {
      return { ok: false, error: "That share doesn't look like an amount" };
    }
    if (headRaw && (!Number.isInteger(headcount) || (headcount ?? 0) < 1)) {
      return { ok: false, error: "How many people are splitting it?" };
    }

    // Split derives its total, so the organizer only enters the two numbers
    // they actually know.
    if (mode === "split" && share !== null && headcount !== null) {
      total = share * headcount;
    }
    if (hasFixedShare(mode) && total !== null && share !== null && share > total) {
      return { ok: false, error: "A share can't exceed the total" };
    }

    const { error: fundErr } = await supa.from("funds").insert({
      event_id: event.id,
      mode,
      recipient_name: recipientName,
      total_cents: total,
      share_cents: hasFixedShare(mode) ? share : null,
      headcount: mode === "split" ? headcount : null,
      method,
      handle,
    });
    // A failed fund shouldn't discard a valid event — the organizer can add it
    // again from the manage page.
    if (fundErr) console.error("fund insert failed", fundErr);
  }

  const shareUrl = `${appUrl()}/e/${slug}`;
  const manageUrl = `${appUrl()}/manage/${edit_token}`;

  // Guests need the manage link emailed — it's their only way back. Signed-in
  // organizers have the dashboard instead.
  // Fire and forget — don't fail the create if email errors.
  if (!user) {
    sendCreatorWelcome({
      to: data.creator_email,
      eventName: data.name,
      shareUrl,
      manageUrl,
    }).catch((e) => console.error("welcome email failed", e));
  }

  redirect(`/manage/${edit_token}?welcome=1`);
}
