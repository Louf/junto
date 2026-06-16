"use client";

import { motion } from "framer-motion";
import { SignupSheet } from "./SignupSheet";

export function JobCard({
  job,
}: {
  job: {
    id: string;
    title: string;
    description: string | null;
    capacity: number;
    filled: number;
    signupNames: string[];
  };
}) {
  const full = job.filled >= job.capacity;
  const pct = Math.min(100, Math.round((job.filled / job.capacity) * 100));
  const remaining = Math.max(0, job.capacity - job.filled);

  return (
    <SignupSheet job={job} disabled={full}>
      <button
        type="button"
        className="w-full text-left rounded-2xl bg-card border border-border p-5 flex flex-col gap-3 active:scale-[0.99] transition disabled:opacity-90"
        disabled={full}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[18px] font-semibold leading-tight truncate">
              {job.title}
            </h3>
            {job.description && (
              <p className="mt-1 text-sm text-muted line-clamp-2">
                {job.description}
              </p>
            )}
          </div>
          {full ? (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className="shrink-0 inline-flex items-center rounded-full bg-success/15 text-success px-3 py-1 text-[12px] font-semibold uppercase tracking-wider"
            >
              Full
            </motion.span>
          ) : (
            <span className="shrink-0 text-[13px] text-muted tabular-nums">
              {remaining} left
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative h-2 flex-1 rounded-full bg-foreground/[0.07] overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className={`absolute inset-y-0 left-0 ${full ? "bg-success" : "bg-foreground"}`}
            />
          </div>
          <span className="text-[13px] text-muted tabular-nums shrink-0">
            {job.filled}/{job.capacity}
          </span>
        </div>

        {job.signupNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {job.signupNames.map((n, i) => (
              <span
                key={i}
                className="rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-[12px]"
              >
                {n}
              </span>
            ))}
          </div>
        )}
      </button>
    </SignupSheet>
  );
}
