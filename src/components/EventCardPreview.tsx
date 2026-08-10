import Link from "next/link";

export type PreviewJob = {
  id?: string;
  title: string;
  capacity: number;
  /** Omit for an unfilled preview. */
  filled?: number;
};

type Props = {
  title: string;
  /** Rendered muted when the title is a stand-in for empty input. */
  titleIsPlaceholder?: boolean;
  dateLabel?: string | null;
  jobs: PreviewJob[];
  /** Defaults to "N of M slots filled". */
  summary?: string;
  ctaLabel?: string;
  /** When set the CTA is a real link; otherwise it is inert. */
  ctaHref?: string;
  emptyHint?: string;
  /** Whole card is announced as one image with this label. */
  ariaLabel: string;
  className?: string;
};

export function EventCardPreview({
  title,
  titleIsPlaceholder = false,
  dateLabel,
  jobs,
  summary,
  ctaLabel = "Claim a slot",
  ctaHref,
  emptyHint = "Add a job and it will show up here.",
  ariaLabel,
  className = "",
}: Props) {
  const total = jobs.reduce((n, j) => n + j.capacity, 0);
  const filled = jobs.reduce((n, j) => n + (j.filled ?? 0), 0);

  return (
    <div
      className={`w-full rounded-3xl border border-border bg-card p-5 lg:p-6 ${className}`}
      role="img"
      aria-label={ariaLabel}
    >
      <div aria-hidden className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            className={`truncate text-[17px] font-semibold leading-tight ${
              titleIsPlaceholder ? "text-muted" : ""
            }`}
          >
            {title}
          </h2>
          {dateLabel && (
            <span className="shrink-0 text-[12px] text-muted tabular-nums">
              {dateLabel}
            </span>
          )}
        </div>

        <p className="-mt-2 text-[13px] text-muted tabular-nums">
          {summary ?? `${filled} of ${total} slots filled`}
        </p>

        {jobs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
            {emptyHint}
          </p>
        ) : (
          <ul className="flex flex-col gap-3.5">
            {jobs.map((job, i) => {
              const done = job.filled ?? 0;
              const isFull = done >= job.capacity;
              const pct = Math.min(
                100,
                Math.round((done / Math.max(1, job.capacity)) * 100),
              );

              return (
                <li key={job.id ?? `${job.title}-${i}`} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`truncate text-[14px] font-medium leading-tight ${
                        job.title ? "" : "text-muted"
                      }`}
                    >
                      {job.title || "Untitled job"}
                    </span>
                    {isFull ? (
                      <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-success">
                        Full
                      </span>
                    ) : (
                      <span className="shrink-0 text-[12px] text-muted tabular-nums">
                        {done}/{job.capacity}
                      </span>
                    )}
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ${
                        isFull ? "bg-success" : "bg-foreground"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {ctaHref ? (
        <Link
          href={ctaHref}
          tabIndex={-1}
          aria-hidden
          className="mt-5 flex h-[38px] items-center justify-center rounded-xl bg-accent text-[13.5px] font-medium text-accent-fg transition active:scale-[0.99]"
        >
          {ctaLabel}
        </Link>
      ) : (
        <div
          aria-hidden
          className="mt-5 flex h-[38px] items-center justify-center rounded-xl bg-accent text-[13.5px] font-medium text-accent-fg"
        >
          {ctaLabel}
        </div>
      )}
    </div>
  );
}

export default EventCardPreview;
