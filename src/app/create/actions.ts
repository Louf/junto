"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/service";
import { newSlug, newToken } from "@/lib/ids";
import { sendCreatorWelcome } from "@/lib/email";
import { appUrl } from "@/lib/env";

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
  jobs: z.array(jobSchema).min(1, "Add at least one job"),
});

export type CreateState =
  | { ok: false; error: string }
  | { ok: true };

export async function createEvent(_prev: unknown, formData: FormData): Promise<CreateState> {
  const raw = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    event_at: String(formData.get("event_at") ?? ""),
    creator_email: String(formData.get("creator_email") ?? "").trim().toLowerCase(),
    jobs: JSON.parse(String(formData.get("jobs") ?? "[]")),
  };

  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const eventAtIso = new Date(data.event_at).toISOString();

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
      name: data.name,
      description: data.description,
      event_at: eventAtIso,
      banner_path,
      creator_email: data.creator_email,
      edit_token,
      slug,
    })
    .select("*")
    .single();
  if (insertErr || !event) {
    return { ok: false, error: insertErr?.message ?? "Could not create event" };
  }

  const jobRows = data.jobs.map((j, i) => ({
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

  const shareUrl = `${appUrl()}/e/${slug}`;
  const manageUrl = `${appUrl()}/manage/${edit_token}`;

  // Fire and forget — don't fail the create if email errors.
  sendCreatorWelcome({
    to: data.creator_email,
    eventName: data.name,
    shareUrl,
    manageUrl,
  }).catch((e) => console.error("welcome email failed", e));

  redirect(`/manage/${edit_token}?welcome=1`);
}
