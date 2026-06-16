"use client";

import { useActionState, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createEvent, type CreateState } from "./actions";

type JobDraft = { title: string; description: string; capacity: number };

const initialState: CreateState | null = null;

export function CreateForm() {
  const [jobs, setJobs] = useState<JobDraft[]>([
    { title: "", description: "", capacity: 1 },
  ]);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, formAction] = useActionState<CreateState | null, FormData>(
    createEvent as unknown as (
      prev: CreateState | null,
      fd: FormData,
    ) => Promise<CreateState>,
    initialState,
  );

  function updateJob(i: number, patch: Partial<JobDraft>) {
    setJobs((js) => js.map((j, idx) => (idx === i ? { ...j, ...patch } : j)));
  }

  function addJob() {
    setJobs((js) => [...js, { title: "", description: "", capacity: 1 }]);
  }

  function removeJob(i: number) {
    setJobs((js) => (js.length <= 1 ? js : js.filter((_, idx) => idx !== i)));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("jobs", JSON.stringify(jobs));
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7">
      <Section title="Event">
        <Field label="Name">
          <input
            name="name"
            required
            maxLength={120}
            placeholder="Spring Cleanup Day"
            className={inputClass}
          />
        </Field>
        <Field label="Description" optional>
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            placeholder="What's this event about?"
            className={inputClass}
          />
        </Field>
        <Field label="Date & time">
          <input
            name="event_at"
            type="datetime-local"
            required
            className={inputClass}
          />
        </Field>
        <Field label="Banner image" optional>
          <input
            name="banner"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setBannerPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="block w-full text-sm text-foreground/80 file:mr-3 file:rounded-xl file:border-0 file:bg-foreground/5 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-foreground/10"
          />
          {bannerPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerPreview}
              alt="banner preview"
              className="mt-2 aspect-[16/9] w-full rounded-xl object-cover"
            />
          )}
        </Field>
      </Section>

      <Section title="Jobs" subtitle="Each job has a number of slots people can claim.">
        <AnimatePresence initial={false}>
          {jobs.map((job, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <input
                  required
                  value={job.title}
                  onChange={(e) => updateJob(i, { title: e.target.value })}
                  placeholder="Job title (e.g. Setup crew)"
                  className={inputClass}
                />
                {jobs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeJob(i)}
                    aria-label="Remove job"
                    className="shrink-0 h-10 w-10 rounded-xl text-muted hover:bg-foreground/5 active:scale-95 transition"
                  >
                    ✕
                  </button>
                )}
              </div>
              <textarea
                value={job.description}
                onChange={(e) => updateJob(i, { description: e.target.value })}
                rows={2}
                placeholder="Optional details"
                className={inputClass}
              />
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-muted">Slots needed</label>
                <div className="flex items-center gap-2">
                  <Stepper
                    value={job.capacity}
                    onChange={(v) => updateJob(i, { capacity: v })}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <button
          type="button"
          onClick={addJob}
          className="h-12 rounded-2xl border border-dashed border-border text-foreground/80 hover:bg-foreground/5 active:scale-[0.99] transition"
        >
          + Add another job
        </button>
      </Section>

      <Section title="Your email" subtitle="We'll email you a link to manage this event.">
        <input
          name="creator_email"
          type="email"
          required
          placeholder="you@example.com"
          className={inputClass}
        />
      </Section>

      {state && !state.ok && (
        <div className="rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-14 rounded-2xl bg-accent text-accent-fg text-[17px] font-semibold disabled:opacity-60 active:scale-[0.98] transition"
      >
        {pending ? "Creating…" : "Create event"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-xl bg-foreground/[0.04] border border-transparent px-4 py-3 text-[16px] outline-none focus:border-foreground/20 focus:bg-foreground/[0.02] transition placeholder:text-muted";

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-muted mt-1">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 text-muted font-normal">· optional</span>}
      </span>
      {children}
    </label>
  );
}

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-foreground/[0.05] p-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="h-9 w-9 rounded-lg hover:bg-foreground/10 active:scale-95 transition"
        aria-label="Decrease"
      >
        −
      </button>
      <div className="w-10 text-center text-[15px] font-semibold tabular-nums">
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(500, value + 1))}
        className="h-9 w-9 rounded-lg hover:bg-foreground/10 active:scale-95 transition"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
