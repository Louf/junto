import { supabaseService } from "./supabase/service";
import type { EventWithJobs } from "./types";

const EVENT_SELECT =
  "*, jobs:jobs(*, signups:signups(*)), fund:funds(*, contributions:contributions(*))";

/**
 * Supabase returns embedded one-to-one relations as an array. Normalize the
 * fund to a single row (or null) and sort everything by its stable order.
 */
function shape(data: unknown): EventWithJobs {
  const ev = data as EventWithJobs & {
    fund: EventWithJobs["fund"] | EventWithJobs["fund"][];
  };

  ev.fund = Array.isArray(ev.fund) ? (ev.fund[0] ?? null) : (ev.fund ?? null);
  if (ev.fund) {
    ev.fund.contributions ??= [];
    ev.fund.contributions.sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
  }

  ev.jobs.sort((a, b) => a.sort_order - b.sort_order);
  for (const job of ev.jobs) {
    job.signups.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  return ev as EventWithJobs;
}

export async function getEventBySlug(slug: string): Promise<EventWithJobs | null> {
  const supa = supabaseService();
  const { data, error } = await supa
    .from("events")
    .select(EVENT_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return shape(data);
}

export async function getEventByEditToken(
  token: string,
): Promise<EventWithJobs | null> {
  const supa = supabaseService();
  const { data, error } = await supa
    .from("events")
    .select(EVENT_SELECT)
    .eq("edit_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return shape(data);
}

export function bannerPublicUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/event-banners/${path}`;
}
