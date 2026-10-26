import { notFound } from "next/navigation";
import Link from "next/link";
import { ThemeMenu } from "@/components/ThemeMenu";
import { SheetLive } from "@/components/SheetLive";
import { getEventByEditToken, bannerPublicUrl } from "@/lib/events";
import { appUrl } from "@/lib/env";
import { ShareCard } from "./ShareCard";
import { AddJobForm } from "./AddJobForm";
import { JobAdmin } from "./JobAdmin";
import { EditEventCard } from "./EditEventCard";
import { FundAdmin } from "./FundAdmin";
import { CancelEventCard } from "./CancelEventCard";
import { DuplicateEventCard } from "./DuplicateEventCard";
import { SheetAdmin } from "./SheetAdmin";

export const revalidate = 0;

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ editToken: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { editToken } = await params;
  const { welcome } = await searchParams;
  const ev = await getEventByEditToken(editToken);
  if (!ev) notFound();

  const shareUrl = `${appUrl()}/e/${ev.slug}`;
  const banner = bannerPublicUrl(ev.banner_path);
  const isSheet = ev.kind === "sheet";

  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  const shapeLabel = isSheet
    ? `the same ${plural(ev.sheet_rows.length, "name", "names")} and ${plural(ev.sheet_columns.length, "column", "columns")}`
    : ev.jobs.length === 1
      ? "job"
      : `${ev.jobs.length} jobs`;

  return (
    <main className="mx-auto w-full max-w-md px-6 pt-8 pb-16">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/e/${ev.slug}`}
          className="text-[13px] text-muted underline underline-offset-2"
        >
          View public page →
        </Link>
        <ThemeMenu />
      </div>

      {ev.cancelled_at && (
        <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          This event is cancelled. The public page still works so people can
          see what happened, but signups and payments are closed.
        </div>
      )}

      {welcome && !ev.cancelled_at && (
        <div className="mt-4 rounded-2xl bg-success/15 text-success px-4 py-3 text-sm">
          Your event is live. Bookmark this page — it&rsquo;s how you&rsquo;ll
          edit later, {isSheet ? "change the sheet" : "add jobs"}, and collect
          money if the event needs any.
        </div>
      )}

      <div className="mt-4">
        <EditEventCard
          token={editToken}
          initial={{
            name: ev.name,
            description: ev.description,
            event_at: ev.event_at,
            event_tz: ev.event_tz,
            location: ev.location,
            duration_minutes: ev.duration_minutes,
          }}
          bannerUrl={banner}
          isSheet={isSheet}
        />
      </div>

      <div className="mt-6">
        <ShareCard shareUrl={shareUrl} />
      </div>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
          Chip in
        </h2>
        <p className="mt-1 text-sm text-muted">
          Optional. Pay someone back, split a cost, or raise a total.
        </p>
        <div className="mt-3">
          <FundAdmin
            token={editToken}
            suggestedHeadcount={
              (isSheet
                ? ev.sheet_rows.length
                : ev.jobs.reduce((n, j) => n + j.signups.length, 0)) || null
            }
            fund={
              ev.fund
                ? {
                    mode: ev.fund.mode,
                    recipientName: ev.fund.recipient_name,
                    totalCents: ev.fund.total_cents,
                    shareCents: ev.fund.share_cents,
                    headcount: ev.fund.headcount,
                    method: ev.fund.method,
                    handle: ev.fund.handle,
                    note: ev.fund.note,
                    contributions: ev.fund.contributions.map((c) => ({
                      id: c.id,
                      name: c.name,
                      email: c.email,
                      amountCents: c.amount_cents,
                      confirmed: c.status === "confirmed",
                    })),
                  }
                : null
            }
          />
        </div>
      </section>

      {isSheet ? (
        <section className="mt-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            Sheet
          </h2>
          <p className="mt-1 text-sm text-muted">
            To tick boxes for someone, use the public page like everyone else.
          </p>
          <SheetLive eventId={ev.id} />
          <div className="mt-3">
            <SheetAdmin
              token={editToken}
              columns={ev.sheet_columns.map((c) => ({
                id: c.id,
                label: c.label,
                count: ev.sheet_rows.filter((r) => r.ticks.includes(c.id)).length,
              }))}
              rows={ev.sheet_rows.map((r) => ({
                id: r.id,
                name: r.name,
                note: r.note,
                selfAdded: r.self_added,
                ticked: ev.sheet_columns
                  .filter((c) => r.ticks.includes(c.id))
                  .map((c) => c.label),
              }))}
            />
          </div>
        </section>
      ) : (
        <section className="mt-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            Jobs & signups
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {ev.jobs.map((job) => (
              <JobAdmin
                key={job.id}
                token={editToken}
                job={{
                  id: job.id,
                  title: job.title,
                  description: job.description,
                  capacity: job.capacity,
                  signups: job.signups.map((s) => ({
                    id: s.id,
                    name: s.name,
                    email: s.email,
                    note: s.note,
                  })),
                }}
              />
            ))}
            <AddJobForm token={editToken} />
          </div>
        </section>
      )}

      <section className="mt-10 flex flex-col gap-3">
        <DuplicateEventCard
          token={editToken}
          shapeLabel={shapeLabel}
          freshLabel={isSheet ? "Ticks and notes" : "Signups"}
          hasFund={Boolean(ev.fund)}
        />
        <CancelEventCard
          token={editToken}
          cancelledAt={ev.cancelled_at}
          cancelReason={ev.cancel_reason}
          pledgeCount={ev.fund?.contributions.length ?? 0}
        />
      </section>
    </main>
  );
}
