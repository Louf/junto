import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getEventBySlug, bannerPublicUrl } from "@/lib/events";
import { JobCard } from "./JobCard";

export const revalidate = 0;

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ev = await getEventBySlug(slug);
  if (!ev) notFound();

  const banner = bannerPublicUrl(ev.banner_path);
  const when = new Date(ev.event_at);

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

      <div className="px-6 -mt-6">
        <div className="rounded-3xl bg-card border border-border p-6 shadow-sm">
          <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            {format(when, "EEEE, MMM d")} · {format(when, "h:mm a")}
          </div>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
            {ev.name}
          </h1>
          {ev.description && (
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/80 whitespace-pre-wrap">
              {ev.description}
            </p>
          )}
        </div>
      </div>

      <section className="mt-8 px-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
          Jobs
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          {ev.jobs.map((job) => (
            <JobCard
              key={job.id}
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
