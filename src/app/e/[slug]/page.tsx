import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getEventBySlug, bannerPublicUrl } from "@/lib/events";
import { formatEventDate } from "@/lib/dates";
import {
  GOAL_PRESETS,
  formatCents,
  hasFixedShare,
  payProfileUrl,
  payUrl,
  payableInDesktopBrowser,
} from "@/lib/payments";
import { qrSvg } from "@/lib/qr";
import { JobCard } from "./JobCard";
import { FundCard } from "./FundCard";

export const revalidate = 0;

/**
 * Junto is shared as a link, so the unfurl is the first impression. Describe
 * what someone gets by tapping, not just the event's name.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ev = await getEventBySlug(slug);
  if (!ev) return { title: "Event not found — Junto" };

  const when = formatEventDate(ev.event_at, ev.event_tz, "long");
  const capacity = ev.jobs.reduce((n, j) => n + j.capacity, 0);
  const filled = ev.jobs.reduce((n, j) => n + j.signups.length, 0);
  const remaining = Math.max(0, capacity - filled);

  const title = ev.cancelled_at
    ? `Cancelled: ${ev.name}`
    : `${ev.name} — Junto`;

  const description = ev.cancelled_at
    ? `This event has been cancelled. ${ev.cancel_reason ?? ""}`.trim()
    : ev.description?.trim() ||
      `${when}. ${
        remaining === 0
          ? "Every slot is filled."
          : `${remaining} of ${capacity} slots still open.`
      }`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `/e/${ev.slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
    // A cancelled or private-ish event shouldn't accumulate search presence.
    robots: { index: false, follow: false },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ev = await getEventBySlug(slug);
  if (!ev) notFound();

  const banner = bannerPublicUrl(ev.banner_path);

  const cancelled = Boolean(ev.cancelled_at);
  const pledgeCount = ev.fund?.contributions.length ?? 0;

  // A fund without a target is still being set up — hide it from payers rather
  // than asking them to send an unknown sum. Fixed modes also need a share.
  // A cancelled event closes the fund outright.
  const ready =
    !cancelled &&
    ev.fund &&
    ev.fund.total_cents &&
    (!hasFixedShare(ev.fund.mode) || ev.fund.share_cents);
  const fund = ready && ev.fund ? { ...ev.fund, total_cents: ev.fund.total_cents! } : null;

  // Payment links and QRs are built server-side from a validated handle, so a
  // pay button can only ever point at a known payment domain. Split has one
  // fixed option; the others get a preset each plus an open-ended one, because
  // the payer chooses how much to send.
  const payOptions = fund
    ? await Promise.all(
        (hasFixedShare(fund.mode)
          ? [fund.share_cents]
          : [...GOAL_PRESETS, null]
        ).map(async (cents) => {
          const href = cents
            ? payUrl(fund.method, fund.handle, cents, ev.name)
            : payProfileUrl(fund.method, fund.handle);
          return {
            cents: cents ?? null,
            label: cents ? formatCents(cents) : "Other",
            href,
            qr: href ? await qrSvg(href) : null,
          };
        }),
      )
    : [];

  const raisedCents =
    fund?.contributions.reduce((n, c) => n + c.amount_cents, 0) ?? 0;

  return (
    <main className="mx-auto w-full max-w-md pb-16">
      {banner ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner}
          alt=""
          className="aspect-[16/9] w-full object-cover"
        />
      ) : (
        <div className="aspect-[16/9] w-full bg-gradient-to-br from-foreground/[0.06] to-foreground/[0.02]" />
      )}

      {cancelled && (
        <div className="px-6 -mt-6">
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-red-600 dark:text-red-400">
              Cancelled
            </p>
            <p className="mt-2 text-[15px] leading-[1.5]">
              This event has been called off. Signups and payments are closed.
            </p>
            {ev.cancel_reason && (
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.5] text-foreground/80">
                {ev.cancel_reason}
              </p>
            )}
            {pledgeCount > 0 && (
              <p className="mt-3 text-[14px] leading-[1.5]">
                Already sent money? Contact the organizer at{" "}
                <a
                  href={`mailto:${ev.creator_email}?subject=${encodeURIComponent(
                    `${ev.name} — cancelled`,
                  )}`}
                  className="underline underline-offset-2"
                >
                  {ev.creator_email}
                </a>
                .
              </p>
            )}
          </div>
        </div>
      )}

      <div className={cancelled ? "mt-6 px-6" : "px-6 -mt-6"}>
        <div className="rounded-3xl bg-card border border-border p-6 shadow-sm">
          <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            {formatEventDate(ev.event_at, ev.event_tz, "dayOnly")} ·{" "}
            {formatEventDate(ev.event_at, ev.event_tz, "timeOnly")}
          </div>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
            {ev.name}
          </h1>
          {ev.location && (
            <p className="mt-2 text-[15px] text-muted">{ev.location}</p>
          )}
          {ev.description && (
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
              {ev.description}
            </p>
          )}

          {!cancelled && (
            <a
              href={`/e/${ev.slug}/event.ics`}
              className="mt-4 inline-flex h-10 items-center rounded-xl border border-border px-4 text-[14px] font-medium transition hover:bg-foreground/5"
            >
              Add to calendar
            </a>
          )}
        </div>
      </div>

      {fund && (
        <section className="mt-8 px-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            Chip in
          </h2>
          <div className="mt-3">
            <FundCard
              fundId={fund.id}
              mode={fund.mode}
              recipientName={fund.recipient_name}
              method={fund.method}
              handle={fund.handle}
              totalCents={fund.total_cents}
              shareCents={fund.share_cents}
              headcount={fund.headcount}
              raisedCents={raisedCents}
              note={fund.note}
              payOptions={payOptions}
              desktopBrowserWorks={payableInDesktopBrowser(fund.method)}
              contributors={fund.contributions.map((c) => ({
                id: c.id,
                name: c.name,
                amountCents: c.amount_cents,
                confirmed: c.status === "confirmed",
              }))}
            />
          </div>
        </section>
      )}

      <section className="mt-8 px-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
          Jobs
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {ev.jobs.map((job) => (
            <JobCard
              key={job.id}
              closed={cancelled}
              job={{
                id: job.id,
                title: job.title,
                description: job.description,
                capacity: job.capacity,
                filled: job.signups.length,
                signupNames: job.signups.map((s) => s.name),
              }}
            />
          ))}
        </div>
      </section>

      <footer className="mt-12 px-6 text-center text-[13px] text-muted">
        Organized with{" "}
        <Link href="/" className="underline underline-offset-2">
          Junto
        </Link>
      </footer>
    </main>
  );
}
