import { supabaseService } from "@/lib/supabase/service";
import { appUrl } from "@/lib/env";
import { formatEventDate } from "@/lib/dates";
import {
  sendEventReminders,
  sendOrganizerNudge,
  type ReminderRecipient,
} from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily sweep: remind claimants about tomorrow, nudge organizers about slots
 * that are still empty.
 *
 * A daily sweep rather than "exactly 24 hours before" because Vercel's Hobby
 * plan allows one cron a day and fires it anywhere within the hour. That turns
 * out to be the better product anyway — one predictable morning email instead
 * of notifications scattered through the day.
 *
 * The endpoint is deliberately a plain authenticated route rather than anything
 * platform-specific, so any scheduler can call it and you can trigger it by
 * hand while testing.
 */

/** Everything starting within this window counts as "tomorrow". */
const CLAIMANT_WINDOW_HOURS = 36;
/** Organizers get more notice, since acting on it means finding a person. */
const ORGANIZER_WINDOW_HOURS = 72;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET is not set — refusing to run");
    return Response.json({ error: "Not configured" }, { status: 500 });
  }

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; anything else can
  // use the same header.
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = supabaseService();
  const now = new Date();
  const horizon = new Date(
    now.getTime() + ORGANIZER_WINDOW_HOURS * 60 * 60 * 1000,
  );

  // Upcoming, not cancelled, within the widest window we care about.
  const { data, error } = await supa
    .from("events")
    .select(
      "id, slug, name, event_at, event_tz, location, creator_email, edit_token, cancelled_at, jobs:jobs(id, title, capacity, signups:signups(id, name, email, cancel_token))",
    )
    .is("cancelled_at", null)
    .gte("event_at", now.toISOString())
    .lte("event_at", horizon.toISOString());

  if (error) {
    console.error("[cron] event lookup failed", error);
    return Response.json({ error: "Lookup failed" }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = (data ?? []) as any[];

  // Which reminders already went out. Read once rather than per event.
  const { data: sentRows } = await supa
    .from("sent_reminders")
    .select("kind, event_id, signup_id")
    .in(
      "event_id",
      events.map((e) => e.id),
    );

  const sentSignups = new Set(
    (sentRows ?? [])
      .filter((r) => r.kind === "claimant" && r.signup_id)
      .map((r) => r.signup_id as string),
  );
  const nudgedEvents = new Set(
    (sentRows ?? [])
      .filter((r) => r.kind === "organizer_nudge")
      .map((r) => r.event_id as string),
  );

  let remindersSent = 0;
  let remindersFailed = 0;
  let nudges = 0;

  for (const ev of events) {
    const startsAt = new Date(ev.event_at);
    const hoursAway = (startsAt.getTime() - now.getTime()) / 3_600_000;
    const when = formatEventDate(ev.event_at, ev.event_tz, "long");
    const shareUrl = `${appUrl()}/e/${ev.slug}`;

    // ---- Claimants ----
    if (hoursAway <= CLAIMANT_WINDOW_HOURS) {
      const recipients: ReminderRecipient[] = [];
      const signupIds: string[] = [];

      for (const job of ev.jobs ?? []) {
        for (const s of job.signups ?? []) {
          if (sentSignups.has(s.id)) continue;
          recipients.push({
            email: s.email,
            name: s.name,
            jobTitle: job.title,
            cancelUrl: `${appUrl()}/cancel/${s.cancel_token}`,
          });
          signupIds.push(s.id);
        }
      }

      if (recipients.length > 0) {
        // Record first. A duplicate send is worse than a missed one, and the
        // unique index means a concurrent run can't also claim these.
        const { error: logErr } = await supa.from("sent_reminders").insert(
          signupIds.map((id) => ({
            event_id: ev.id,
            kind: "claimant",
            signup_id: id,
          })),
        );

        if (logErr) {
          console.error("[cron] could not log reminders, skipping send", logErr);
        } else {
          const res = await sendEventReminders({
            recipients,
            eventName: ev.name,
            when,
            location: ev.location,
            shareUrl,
            calendarUrl: `${shareUrl}/event.ics`,
            organizerEmail: ev.creator_email,
          });
          remindersSent += res.sent;
          remindersFailed += res.failed;
        }
      }
    }

    // ---- Organizer, only if slots are actually empty ----
    if (!nudgedEvents.has(ev.id)) {
      const capacity = (ev.jobs ?? []).reduce(
        (n: number, j: { capacity: number }) => n + j.capacity,
        0,
      );
      const filled = (ev.jobs ?? []).reduce(
        (n: number, j: { signups?: unknown[] }) => n + (j.signups?.length ?? 0),
        0,
      );
      const remaining = capacity - filled;
      const emptyJobs = (ev.jobs ?? [])
        .filter(
          (j: { capacity: number; signups?: unknown[] }) =>
            (j.signups?.length ?? 0) < j.capacity,
        )
        .map((j: { title: string }) => j.title);

      if (remaining > 0 && emptyJobs.length > 0) {
        const { error: logErr } = await supa
          .from("sent_reminders")
          .insert({ event_id: ev.id, kind: "organizer_nudge", signup_id: null });

        if (!logErr) {
          await sendOrganizerNudge({
            to: ev.creator_email,
            eventName: ev.name,
            when,
            remaining,
            emptyJobs,
            shareUrl,
            manageUrl: `${appUrl()}/manage/${ev.edit_token}`,
          }).catch((e) => console.error("[cron] nudge failed", e));
          nudges += 1;
        }
      }
    }
  }

  const summary = {
    events: events.length,
    remindersSent,
    remindersFailed,
    nudges,
  };
  console.log("[cron] reminders", summary);
  return Response.json({ ok: true, ...summary });
}
