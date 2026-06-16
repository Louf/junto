"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/service";
import { newToken } from "@/lib/ids";

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
