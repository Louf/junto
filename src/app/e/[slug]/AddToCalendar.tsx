"use client";

import { useSyncExternalStore } from "react";

type Lead = "file" | "google";

/**
 * Which calendar to lead with. Apple devices open a .ics file straight into
 * Calendar, and Windows into Outlook; Android and Chromebooks are almost
 * always on Google Calendar, which can't open a downloaded file in one step.
 * iPadOS reports itself as a Mac, which lands it in the right bucket anyway.
 */
function leadFor(userAgent: string): Lead {
  if (/android|cros/i.test(userAgent)) return "google";
  if (/iphone|ipad|ipod|macintosh|windows/i.test(userAgent)) return "file";
  return "google";
}

const noSubscribe = () => () => {};

/**
 * "Add to calendar", led by whichever option suits this device, with the other
 * one as a small link beside it for when the guess is wrong.
 *
 * The server can't see the device, so it renders the file-first version and
 * the browser swaps the order after hydration if needed. Both versions have
 * the same shape, so the swap is just two labels trading places.
 */
export function AddToCalendar({
  icsHref,
  googleHref,
}: {
  icsHref: string;
  googleHref: string;
}) {
  const lead = useSyncExternalStore<Lead>(
    noSubscribe,
    () => leadFor(navigator.userAgent),
    () => "file",
  );

  const file = { href: icsHref, external: false };
  const google = { href: googleHref, external: true };
  const [primary, secondary] =
    lead === "google"
      ? [
          { ...google, label: "Add to Google Calendar" },
          { ...file, label: "another calendar" },
        ]
      : [
          { ...file, label: "Add to calendar" },
          { ...google, label: "Google Calendar" },
        ];

  const linkProps = (l: { external: boolean }) =>
    l.external ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <a
        href={primary.href}
        {...linkProps(primary)}
        className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-[14px] font-medium transition hover:bg-foreground/5"
      >
        {primary.label}
      </a>
      <span className="text-[13px] text-muted">
        or{" "}
        <a
          href={secondary.href}
          {...linkProps(secondary)}
          className="underline underline-offset-2 transition hover:text-foreground"
        >
          {secondary.label}
        </a>
      </span>
    </div>
  );
}
