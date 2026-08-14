import { getEventBySlug } from "@/lib/events";
import { eventEndsAt } from "@/lib/dates";
import { buildIcs } from "@/lib/ics";
import { appUrl } from "@/lib/env";

export const revalidate = 0;

/**
 * The event as a calendar file.
 *
 * Junto's tagline is "Sign up. Show up." — this is the second half. The UID is
 * derived from the slug so re-downloading updates the existing entry rather
 * than creating a duplicate, which also means a cancelled event can supersede
 * the original.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ev = await getEventBySlug(slug);
  if (!ev) return new Response("Not found", { status: 404 });

  const descriptionParts = [
    ev.description?.trim(),
    ev.jobs.length
      ? `Jobs: ${ev.jobs.map((j) => `${j.title} (${j.signups.length}/${j.capacity})`).join(", ")}`
      : null,
    `Details and signups: ${appUrl()}/e/${ev.slug}`,
  ].filter(Boolean);

  const ics = buildIcs({
    uid: `${ev.slug}@junto`,
    start: new Date(ev.event_at),
    end: eventEndsAt(ev.event_at, ev.duration_minutes),
    summary: ev.cancelled_at ? `Cancelled: ${ev.name}` : ev.name,
    description: descriptionParts.join("\n\n"),
    location: ev.location,
    url: `${appUrl()}/e/${ev.slug}`,
    organizerEmail: ev.creator_email,
    cancelled: Boolean(ev.cancelled_at),
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Named so the download is recognisable in a downloads folder.
      "Content-Disposition": `attachment; filename="${ev.slug}.ics"`,
      // Signups change the description, and cancelling changes the status.
      "Cache-Control": "no-store",
    },
  });
}
