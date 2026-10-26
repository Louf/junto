import { supabaseService } from "./supabase/service";
import type { EventWithJobs } from "./types";

const EVENT_SELECT =
  "*, jobs:jobs(*, signups:signups(*)), fund:funds(*, contributions:contributions(*)), sheet_columns:sheet_columns(*), sheet_rows:sheet_rows(*, ticks:sheet_ticks(column_id))";

/**
 * Supabase returns embedded one-to-one relations as an array. Normalize the
 * fund to a single row (or null) and sort everything by its stable order.
 */
function shape(data: unknown): EventWithJobs {
  const ev = data as Omit<EventWithJobs, "sheet_rows"> & {
    fund: EventWithJobs["fund"] | EventWithJobs["fund"][];
    sheet_rows: (Omit<EventWithJobs["sheet_rows"][number], "ticks"> & {
      ticks: { column_id: string }[];
    })[];
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

  // Ties on sort_order (bulk-added names) fall back to the order they arrived.
  const bySortThenAge = (
    a: { sort_order: number; created_at: string },
    b: { sort_order: number; created_at: string },
  ) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

  ev.sheet_columns = (ev.sheet_columns ?? []).sort(bySortThenAge);
  const rows = (ev.sheet_rows ?? []).sort(bySortThenAge);

  return {
    ...ev,
    sheet_rows: rows.map((r) => ({
      ...r,
      ticks: (r.ticks ?? []).map((t) => t.column_id),
    })),
  } as EventWithJobs;
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
