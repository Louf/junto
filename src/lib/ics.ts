/**
 * iCalendar (RFC 5545) generation.
 *
 * Deliberately hand-rolled and small: the format is unforgiving about two
 * things — escaping and line length — and both are easy to get wrong and easy
 * to test. Everything here is pure, so it's covered by unit tests rather than
 * by opening a calendar app and squinting.
 *
 * Times are emitted in UTC (`...Z`) rather than with a VTIMEZONE block. The
 * instant is what a calendar needs, UTC is unambiguous, and every client
 * handles it. `event_tz` remains what we display to humans.
 */

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newlines are special. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * RFC 5545 §3.1: lines are limited to 75 octets, continued with CRLF + space.
 *
 * Counted in octets rather than characters — an emoji in an event name is four
 * bytes, and folding by character length produces lines a strict parser
 * rejects. Multi-byte characters are never split across a fold.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  // Continuation lines carry a leading space, so they hold one octet less.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (currentBytes + size > limit) {
      out.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += size;
  }
  if (current) out.push(current);

  return out.join("\r\n ");
}

/** 20261128T000000Z */
export function toIcsUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export type IcsEvent = {
  /** Stable across regenerations so calendars update rather than duplicate. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  organizerEmail?: string | null;
  cancelled?: boolean;
  /** Defaults to now; injectable so tests are deterministic. */
  stamp?: Date;
};

export function buildIcs(event: IcsEvent): string {
  const stamp = event.stamp ?? new Date();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Junto//Event//EN",
    "CALSCALE:GREGORIAN",
    // A cancelled event is published as such so calendars grey out the entry
    // rather than leaving a stale one that looks live.
    `METHOD:${event.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${toIcsUtc(stamp)}`,
    `DTSTART:${toIcsUtc(event.start)}`,
    `DTEND:${toIcsUtc(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    // Bumped on cancel so clients treat it as an update to the same entry.
    `SEQUENCE:${event.cancelled ? 1 : 0}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }
  if (event.organizerEmail) {
    lines.push(`ORGANIZER:mailto:${event.organizerEmail}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  // CRLF is required, and a trailing one closes the final line.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * A link that opens Google Calendar with the event filled in, ready to save.
 *
 * The counterpart to the .ics file for people on Google Calendar, which can't
 * open a downloaded calendar file in one step — Android especially.
 */
export function googleCalendarUrl(input: {
  summary: string;
  start: Date;
  end: Date;
  details?: string | null;
  location?: string | null;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.summary,
    dates: `${toIcsUtc(input.start)}/${toIcsUtc(input.end)}`,
  });
  if (input.details) params.set("details", input.details);
  if (input.location) params.set("location", input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
