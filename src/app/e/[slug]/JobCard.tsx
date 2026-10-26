"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SignupForm, SignupSheet } from "./SignupSheet";

type Job = {
  id: string;
  title: string;
  description: string | null;
  capacity: number;
  filled: number;
  signupNames: string[];
};

const cardBase =
  "rounded-2xl bg-card border transition-[border-color,box-shadow]";

/**
 * On a phone the card opens a bottom sheet; on desktop a sheet is a lot of
 * ceremony for three fields, so the card expands in place instead. Both are
 * rendered and CSS picks one, like DateTimePicker, to keep server and client
 * markup identical.
 */
export function JobCard({
  job,
  closed = false,
}: {
  /** Cancelled event — show the roster but take away the way in. */
  closed?: boolean;
  job: Job;
}) {
  const full = job.filled >= job.capacity;
  const locked = full || closed;

  return (
    <>
      <div className="md:hidden">
        <SignupSheet job={job} disabled={locked}>
          <button
            type="button"
            className={`group w-full text-left p-5 flex flex-col gap-3 active:scale-[0.99] disabled:opacity-90 ${cardBase} border-border`}
            disabled={locked}
          >
            <Summary job={job} full={full} closed={closed} />
          </button>
        </SignupSheet>
      </div>
      <div className="hidden md:block">
        <ExpandingCard job={job} full={full} closed={closed} />
      </div>
    </>
  );
}

function ExpandingCard({
  job,
  full,
  closed,
}: {
  job: Job;
  full: boolean;
  closed: boolean;
}) {
  const locked = full || closed;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <div
      className={`${cardBase} ${
        open
          ? "border-accent/50 shadow-sm"
          : locked
            ? "border-border"
            : "border-border hover:border-accent/40 hover:shadow-sm"
      }`}
      onKeyDown={(e) => {
        if (open && e.key === "Escape") close();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={locked}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="group w-full cursor-pointer text-left p-5 flex flex-col gap-3 rounded-2xl disabled:cursor-default disabled:opacity-90"
      >
        <Summary job={job} full={full} closed={closed} open={open} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="signup"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="overflow-hidden"
          >
            <div className="mx-5 border-t border-border pb-5 pt-4">
              <SignupForm job={job} onDone={close} inline />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Summary({
  job,
  full,
  closed,
  open = false,
}: {
  job: Job;
  full: boolean;
  closed: boolean;
  open?: boolean;
}) {
  const pct = Math.min(100, Math.round((job.filled / job.capacity) * 100));
  const remaining = Math.max(0, job.capacity - job.filled);

  return (
    <>
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
        ) : closed ? (
          <span className="shrink-0 text-[13px] text-muted">Closed</span>
        ) : (
          // The card is the button; this just makes that obvious.
          <span
            aria-hidden
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              open
                ? "bg-foreground/[0.06] text-muted"
                : "bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-fg"
            }`}
          >
            {open ? "Close" : "Sign up"}
            <svg
              viewBox="0 0 16 16"
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
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
          {full || closed
            ? `${job.filled}/${job.capacity}`
            : `${job.filled}/${job.capacity} · ${remaining} left`}
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
    </>
  );
}
