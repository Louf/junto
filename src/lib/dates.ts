import { formatInTimeZone } from "date-fns-tz";

/**
 * Event dates, always rendered in the zone the event happens in.
 *
 * `event_at` is a timestamptz so the instant is unambiguous, but formatting it
 * with date-fns' `format` uses whatever timezone the *runtime* is in. Server
 * components render on the host — UTC on most platforms — so a 6pm Chicago
 * potluck printed as "Saturday, November 28 at 12:00 AM".
 *
 * Junto's events are in-person: the useful time is the local time at the
 * event, identical for every viewer. So we store the organizer's zone and
 * format in it everywhere — page, emails, OG image, metadata.
 */

/** Used for rows created before event_tz existed, and labelled so it shows. */
export const FALLBACK_TZ = "UTC";

export function eventZone(tz: string | null | undefined): string {
  return tz && tz.trim() ? tz : FALLBACK_TZ;
}

/** The zone the current browser is in. Client-side only. */
export function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TZ;
  } catch {
    return FALLBACK_TZ;
  }
}

/** A zone string is only useful if the runtime actually knows it. */
export function isValidZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Patterns. `zzz` appends the zone abbreviation (CST, GMT) — worth the noise
 * on anything someone might act on, so a link shared across states can't be
 * misread by an hour.
 */
export const DATE_FORMATS = {
  /** Friday, November 27 at 6:00 PM CST */
  long: "EEEE, MMMM d 'at' h:mm a zzz",
  /** Friday, Nov 27 */
  dayOnly: "EEEE, MMM d",
  /** 6:00 PM CST */
  timeOnly: "h:mm a zzz",
  /** Fri, Nov 27 · 6:00 PM */
  compact: "EEE, MMM d · h:mm a",
  /** November 27 · 6:00 PM CST — for the OG image */
  preview: "EEEE, MMMM d · h:mm a zzz",
} as const;

export function formatEventDate(
  instant: string | Date,
  tz: string | null | undefined,
  pattern: keyof typeof DATE_FORMATS = "long",
): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return formatInTimeZone(date, eventZone(tz), DATE_FORMATS[pattern]);
}
