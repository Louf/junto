import { supabaseService } from "./supabase/service";
import type { EventWithJobs } from "./types";

export async function getEventBySlug(slug: string): Promise<EventWithJobs | null> {
  const supa = supabaseService();
  const { data, error } = await supa
    .from("events")
    .select(
      "*, jobs:jobs(*, signups:signups(*))",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const ev = data as unknown as EventWithJobs;
  ev.jobs.sort((a, b) => a.sort_order - b.sort_order);
  for (const job of ev.jobs) {
    job.signups.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return ev;
}

export async function getEventByEditToken(
  token: string,
): Promise<EventWithJobs | null> {
  const supa = supabaseService();
  const { data, error } = await supa
    .from("events")
    .select("*, jobs:jobs(*, signups:signups(*))")
    .eq("edit_token", token)
    .maybeSingle();
  if (error || !data) return null;
  const ev = data as unknown as EventWithJobs;
  ev.jobs.sort((a, b) => a.sort_order - b.sort_order);
  for (const job of ev.jobs) {
    job.signups.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return ev;
}

export function bannerPublicUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/event-banners/${path}`;
}
