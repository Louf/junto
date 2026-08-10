import { notFound } from "next/navigation";
import Link from "next/link";
import { getEventByEditToken, bannerPublicUrl } from "@/lib/events";
import { appUrl } from "@/lib/env";
import { ShareCard } from "./ShareCard";
import { AddJobForm } from "./AddJobForm";
import { JobAdmin } from "./JobAdmin";
import { EditEventCard } from "./EditEventCard";
import { FundAdmin } from "./FundAdmin";

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

  return (
    <main className="mx-auto w-full max-w-md px-6 pt-8 pb-16">
      <Link
        href={`/e/${ev.slug}`}
        className="text-[13px] text-muted underline underline-offset-2"
      >
        View public page →
      </Link>

      {welcome && (
        <div className="mt-4 rounded-2xl bg-success/15 text-success px-4 py-3 text-sm">
          Your event is live. Bookmark this page — it&rsquo;s how you&rsquo;ll
          edit later, add jobs, and collect money if someone fronts the cost.
        </div>
      )}

      <div className="mt-4">
        <EditEventCard
          token={editToken}
          initial={{
            name: ev.name,
            description: ev.description,
            event_at: ev.event_at,
          }}
          bannerUrl={banner}
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
          Optional. For when someone fronts the cost and needs paying back.
        </p>
        <div className="mt-3">
          <FundAdmin
            token={editToken}
            suggestedShareCents={null}
            fund={
              ev.fund
                ? {
                    payerName: ev.fund.payer_name,
                    totalCents: ev.fund.total_cents,
                    shareCents: ev.fund.share_cents,
                    method: ev.fund.method,
                    handle: ev.fund.handle,
                    note: ev.fund.note,
                    contributions: ev.fund.contributions.map((c) => ({
                      id: c.id,
                      name: c.name,
                      amountCents: c.amount_cents,
                      confirmed: c.status === "confirmed",
                    })),
                  }
                : null
            }
          />
        </div>
      </section>

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
    </main>
  );
}
