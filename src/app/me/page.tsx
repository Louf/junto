import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeMenu } from "@/components/ThemeMenu";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { eventEndsAt, formatEventDate } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { signOut } from "./actions";
import { CopyLinkButton } from "./CopyLinkButton";

export const metadata: Metadata = { title: "Your events — Junto" };
export const revalidate = 0;

type Summary = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  event_at: string;
  event_tz: string | null;
  duration_minutes: number;
  edit_token: string;
  cancelled_at: string | null;
  jobs: { capacity: number; signups: { count: number }[] }[];
  sheet_rows: { sheet_ticks: { count: number }[] }[];
};

/** The organizer's home: every event they run, and a way to start another. */
export default async function MePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/me");

  // Best-effort claim of any events made with this email before signing in.
  try {
    await supabase.rpc("claim_events_by_email");
  } catch {
    // ignore
  }

  // Service client: matches events by account or, for older ones, by email.
  const supa = supabaseService();
  const { data } = await supa
    .from("events")
    .select(
      "id, name, slug, kind, event_at, event_tz, duration_minutes, edit_token, cancelled_at, jobs(capacity, signups(count)), sheet_rows(sheet_ticks(count))",
    )
    .or(`creator_user_id.eq.${user.id},creator_email.eq.${user.email}`)
    .order("event_at", { ascending: true });

  const events = (data ?? []) as unknown as Summary[];
  const { upcoming, past } = splitByTime(events);

  return (
    <main className="mx-auto w-full max-w-md px-6 pt-8 pb-14">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
            Your events
          </h1>
          <p className="mt-1 truncate text-[14px] text-muted">{user.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <form action={signOut}>
            <button
              type="submit"
              className="text-[13px] text-muted hover:text-foreground"
            >
              Sign out
            </button>
          </form>
          <ThemeMenu />
        </div>
      </div>

      <Link
        href="/create"
        className="mt-6 flex h-12 items-center justify-center rounded-2xl bg-accent text-[15px] font-semibold text-accent-fg transition active:scale-[0.98]"
      >
        + New event
      </Link>

      {events.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-[15px] font-medium">No events yet</p>
          <p className="mt-1 text-[14px] text-muted">
            Anything you create while signed in shows up here.
          </p>
        </div>
      ) : (
        <>
          <EventGroup title="Upcoming" events={upcoming} empty="Nothing coming up." />
          {past.length > 0 && <EventGroup title="Past" events={past} muted />}
        </>
      )}
    </main>
  );
}

/**
 * Soonest first for what's coming, most recent first for what's done. An event
 * stays "upcoming" until it has finished, not just started.
 */
function splitByTime(events: Summary[], now = Date.now()) {
  const isPast = (e: Summary) =>
    eventEndsAt(e.event_at, e.duration_minutes).getTime() < now;
  return {
    upcoming: events.filter((e) => !isPast(e)),
    past: events.filter(isPast).reverse(),
  };
}

function EventGroup({
  title,
  events,
  empty,
  muted = false,
}: {
  title: string;
  events: Summary[];
  empty?: string;
  muted?: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
        {title}
      </h2>
      {events.length === 0 ? (
        <p className="mt-3 text-[14px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {events.map((e) => (
            <EventRow key={e.id} event={e} muted={muted} />
          ))}
        </ul>
      )}
    </section>
  );
}

function progress(e: Summary): string {
  if (e.kind === "sheet") {
    const people = e.sheet_rows.length;
    const ticked = e.sheet_rows.filter((r) => (r.sheet_ticks[0]?.count ?? 0) > 0).length;
    return people === 0 ? "No names yet" : `${ticked} of ${people} have ticked`;
  }
  const capacity = e.jobs.reduce((n, j) => n + j.capacity, 0);
  const filled = e.jobs.reduce((n, j) => n + (j.signups[0]?.count ?? 0), 0);
  return `${filled} of ${capacity} slots filled`;
}

function EventRow({ event: e, muted }: { event: Summary; muted: boolean }) {
  return (
    <li
      className={`relative flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-foreground/20 ${
        muted ? "opacity-75" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <span className="truncate">
            {formatEventDate(e.event_at, e.event_tz, "compact")}
          </span>
          <span className="shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-medium">
            {e.kind === "sheet" ? "Sheet" : "Slots"}
          </span>
          {e.cancelled_at && (
            <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
              Cancelled
            </span>
          )}
        </div>
        {/* The whole card opens the event; the copy button sits above it. */}
        <Link
          href={`/manage/${e.edit_token}`}
          className="mt-0.5 block truncate text-[17px] font-semibold after:absolute after:inset-0 after:rounded-2xl"
        >
          {e.name}
        </Link>
        <p className="mt-0.5 text-[13px] text-muted tabular-nums">{progress(e)}</p>
      </div>
      {!e.cancelled_at && (
        <CopyLinkButton url={`${appUrl()}/e/${e.slug}`} label={e.name} />
      )}
    </li>
  );
}
