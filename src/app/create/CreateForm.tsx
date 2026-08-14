"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { nanoid } from "nanoid";
import { format } from "date-fns";
import { createEvent, type CreateState } from "./actions";
import { DateTimePicker } from "@/components/DateTimePicker";
import { EventCardPreview } from "@/components/EventCardPreview";
import { PaymentIcon } from "@/components/PaymentIcon";
import { browserZone } from "@/lib/dates";
import {
  FUND_MODES,
  METHOD_HINTS,
  METHOD_LABELS,
  METHOD_PLACEHOLDERS,
  MODE_HINTS,
  MODE_LABELS,
  PAYMENT_METHODS,
  normalizeHandle,
  type FundMode,
  type PaymentMethod,
} from "@/lib/payments";

type JobDraft = {
  id: string;
  title: string;
  description: string;
  capacity: number;
};

const NAME_MAX = 120;
const BANNER_MAX_BYTES = 5 * 1024 * 1024;

const initialState: CreateState | null = null;

function newJob(): JobDraft {
  return { id: nanoid(8), title: "", description: "", capacity: 1 };
}

export function CreateForm() {
  const [name, setName] = useState("");
  const [jobs, setJobs] = useState<JobDraft[]>(() => [newJob()]);
  const [openJobId, setOpenJobId] = useState<string | null>(() => jobs[0].id);
  const [jobError, setJobError] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [eventAt, setEventAt] = useState<Date | null>(null);
  const [dateError, setDateError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [fundOn, setFundOn] = useState(false);
  const [fundMethod, setFundMethod] = useState<PaymentMethod>("venmo");
  const [fundMode, setFundMode] = useState<FundMode>("reimburse");
  const [pending, startTransition] = useTransition();
  const [state, formAction] = useActionState<CreateState | null, FormData>(
    createEvent as unknown as (
      prev: CreateState | null,
      fd: FormData,
    ) => Promise<CreateState>,
    initialState,
  );

  const reduceMotion = useReducedMotion();
  const errorRef = useRef<HTMLDivElement>(null);
  const dateFieldRef = useRef<HTMLDivElement>(null);
  const jobsRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const titleRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocus = useRef<string | null>(null);

  const panelTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 30 };

  // Pull attention to the server error rather than leaving it off-screen.
  useEffect(() => {
    if (state && !state.ok) {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state]);

  // Autofocus only where a keyboard is likely. On phones it would pop the
  // software keyboard and scroll the page before anyone has read anything.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      nameRef.current?.focus();
    }
  }, []);

  // Object URLs leak unless explicitly released.
  useEffect(() => {
    if (!bannerPreview) return;
    return () => URL.revokeObjectURL(bannerPreview);
  }, [bannerPreview]);

  // Guard against losing a part-filled form. Submitting navigates away on
  // purpose, so the guard lifts while the action is in flight.
  useEffect(() => {
    if (!dirty || pending) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, pending]);

  // A collapsed panel is unmounted, so focus has to wait for it to open.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id || openJobId !== id) return;
    titleRefs.current[id]?.focus();
    pendingFocus.current = null;
  }, [openJobId, jobs]);

  function updateJob(id: string, patch: Partial<JobDraft>) {
    setDirty(true);
    setJobError(null);
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  function addJob() {
    const current = jobs.find((j) => j.id === openJobId);
    if (current && !current.title.trim()) {
      setJobError("Give this job a title before adding another.");
      titleRefs.current[current.id]?.focus();
      return;
    }

    const job = newJob();
    setDirty(true);
    setJobError(null);
    pendingFocus.current = job.id;
    setJobs((js) => [...js, job]);
    setOpenJobId(job.id);
  }

  function removeJob(id: string) {
    setDirty(true);
    setJobError(null);
    setJobs((js) => {
      if (js.length <= 1) return js;
      const next = js.filter((j) => j.id !== id);
      if (openJobId === id) setOpenJobId(next[next.length - 1].id);
      return next;
    });
    delete titleRefs.current[id];
  }

  function onBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setBannerPreview(null);

    if (!file) {
      setBannerError(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setBannerError("That file isn't an image.");
      e.target.value = "";
      return;
    }
    if (file.size > BANNER_MAX_BYTES) {
      setBannerError("Banner must be under 5 MB.");
      e.target.value = "";
      return;
    }

    setBannerError(null);
    setBannerPreview(URL.createObjectURL(file));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (!eventAt) {
      setDateError(true);
      dateFieldRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
      return;
    }
    setDateError(false);

    // Collapsed job inputs are unmounted, so native validation can't reach
    // them — check here and reopen the offender instead.
    const untitled = jobs.find((j) => !j.title.trim());
    if (untitled) {
      setJobError("Every job needs a title.");
      pendingFocus.current = untitled.id;
      setOpenJobId(untitled.id);
      jobsRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setJobError(null);

    fd.set(
      "jobs",
      JSON.stringify(
        jobs.map(({ title, description, capacity }) => ({
          title: title.trim(),
          description,
          capacity,
        })),
      ),
    );
    fd.set("event_at", eventAt.toISOString());
    // The picker works in the organizer's local time, so their zone is the
    // one the event actually happens in.
    fd.set("event_tz", browserZone());
    startTransition(() => formAction(fd));
  }

  const totalSlots = jobs.reduce((n, j) => n + j.capacity, 0);

  const previewCard = (
    <EventCardPreview
      title={name.trim() || "Your event"}
      titleIsPlaceholder={!name.trim()}
      dateLabel={eventAt ? format(eventAt, "MMM d, h:mm a") : null}
      jobs={jobs.map((j) => ({
        id: j.id,
        title: j.title.trim(),
        capacity: j.capacity,
        filled: 0,
      }))}
      summary={`${totalSlots} ${totalSlots === 1 ? "slot" : "slots"} across ${
        jobs.length
      } ${jobs.length === 1 ? "job" : "jobs"}`}
      ariaLabel="Live preview of the event you're creating."
    />
  );

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
      <form
        onSubmit={onSubmit}
        onInput={() => setDirty(true)}
        className="flex flex-col gap-9"
      >
        <Section step={1} title="Event">
          <Field label="Name">
            <input
              ref={nameRef}
              name="name"
              required
              maxLength={NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spring Cleanup Day"
              className={inputClass}
            />
            {name.length >= NAME_MAX - 30 && (
              <span className="text-right text-[12px] text-muted tabular-nums">
                {name.length}/{NAME_MAX}
              </span>
            )}
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

          <div ref={dateFieldRef} className="flex flex-col gap-2">
            <span className="text-sm font-medium">Date &amp; time</span>
            <DateTimePicker
              value={eventAt}
              onChange={(d) => {
                setDirty(true);
                setDateError(false);
                setEventAt(d);
              }}
              minDate={new Date()}
              placeholder="Pick a date & time"
            />
            {dateError && (
              <p
                role="alert"
                className="text-[13px] text-red-600 dark:text-red-400"
              >
                Pick a date and time before creating the event.
              </p>
            )}
          </div>

          <Field label="Banner image" optional>
            <input
              name="banner"
              type="file"
              accept="image/*"
              onChange={onBannerChange}
              className="block w-full text-sm text-foreground/80 file:mr-3 file:rounded-xl file:border-0 file:bg-foreground/5 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-foreground/10"
            />
            {bannerError && (
              <p
                role="alert"
                className="text-[13px] text-red-600 dark:text-red-400"
              >
                {bannerError}
              </p>
            )}
            {bannerPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerPreview}
                alt="Banner preview"
                className="mt-1 aspect-[16/9] w-full rounded-xl object-cover"
              />
            )}
          </Field>
        </Section>

        <Section
          step={2}
          title="Jobs"
          subtitle="Each job has a number of slots people can claim."
        >
          <div ref={jobsRef} className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {jobs.map((job, i) => {
                const isOpen = openJobId === job.id;
                const panelId = `job-panel-${job.id}`;

                return (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={panelTransition}
                    className="rounded-2xl border border-border bg-card px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenJobId(isOpen ? null : job.id)}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                      >
                        <span className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                          Job {i + 1}
                        </span>

                        {!isOpen && (
                          <>
                            <span
                              className={`truncate text-[14px] font-medium ${
                                job.title.trim() ? "" : "text-muted"
                              }`}
                            >
                              {job.title.trim() || "Untitled job"}
                            </span>
                            <span className="ml-auto shrink-0 text-[12px] text-muted tabular-nums">
                              {job.capacity}{" "}
                              {job.capacity === 1 ? "slot" : "slots"}
                            </span>
                          </>
                        )}

                        <svg
                          viewBox="0 0 20 20"
                          aria-hidden
                          className={`size-4 shrink-0 text-muted transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          } ${isOpen ? "ml-auto" : ""}`}
                        >
                          <path
                            d="M5 7.5L10 12.5L15 7.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      {jobs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeJob(job.id)}
                          aria-label={`Remove job ${i + 1}`}
                          className="size-11 shrink-0 rounded-xl text-muted transition hover:bg-foreground/5 active:scale-95"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="panel"
                          id={panelId}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={panelTransition}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-3 pt-3">
                            <Field label="Title">
                              <input
                                ref={(el) => {
                                  titleRefs.current[job.id] = el;
                                }}
                                value={job.title}
                                onChange={(e) =>
                                  updateJob(job.id, { title: e.target.value })
                                }
                                maxLength={120}
                                placeholder="Setup crew"
                                className={inputClass}
                              />
                            </Field>

                            <Field label="Details" optional>
                              <textarea
                                value={job.description}
                                onChange={(e) =>
                                  updateJob(job.id, {
                                    description: e.target.value,
                                  })
                                }
                                rows={2}
                                maxLength={1000}
                                placeholder="Anything people should know before claiming"
                                className={inputClass}
                              />
                            </Field>

                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm text-muted">
                                Slots needed
                              </span>
                              <Stepper
                                label={`Slots needed for job ${i + 1}`}
                                value={job.capacity}
                                onChange={(v) =>
                                  updateJob(job.id, { capacity: v })
                                }
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {jobError && (
            <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
              {jobError}
            </p>
          )}

          <button
            type="button"
            onClick={addJob}
            className="h-12 rounded-2xl border border-dashed border-border text-foreground/80 transition hover:bg-foreground/5 active:scale-[0.99]"
          >
            + Add another job
          </button>
        </Section>

        <Section
          step={3}
          title="Chip in"
          subtitle="Optional. If this event involves money, Junto can help you collect it — whether it's already been spent or not."
        >
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <input
              type="checkbox"
              checked={fundOn}
              onChange={(e) => {
                setDirty(true);
                setFundOn(e.target.checked);
              }}
              className="size-4 accent-[var(--accent)]"
            />
            <span className="text-[15px]">Collect money for this event</span>
          </label>

          <AnimatePresence initial={false}>
            {fundOn && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={panelTransition}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-3 pt-1">
                  <input type="hidden" name="fund_enabled" value="1" />

                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-medium">
                      How you&rsquo;re collecting
                    </legend>
                    <div className="flex flex-col gap-2">
                      {FUND_MODES.map((m) => (
                        <label
                          key={m}
                          className={`cursor-pointer rounded-xl border px-4 py-3 transition ${
                            fundMode === m
                              ? "border-accent bg-accent/10"
                              : "border-border text-foreground/80"
                          }`}
                        >
                          <input
                            type="radio"
                            name="fund_mode"
                            value={m}
                            checked={fundMode === m}
                            onChange={() => setFundMode(m)}
                            className="sr-only"
                          />
                          <span
                            className={`block text-[14px] ${fundMode === m ? "font-medium" : ""}`}
                          >
                            {MODE_LABELS[m]}
                          </span>
                          <span className="mt-0.5 block text-[13px] text-muted">
                            {MODE_HINTS[m]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <Field
                    label={
                      fundMode === "reimburse"
                        ? "Who paid up front"
                        : "Who's collecting"
                    }
                  >
                    <input
                      name="fund_recipient_name"
                      required={fundOn}
                      maxLength={120}
                      placeholder="Dave"
                      className={inputClass}
                    />
                  </Field>

                  <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-sm font-medium">Pay by</legend>
                    <div className="flex flex-wrap gap-2">
                      {PAYMENT_METHODS.map((m) => (
                        <label
                          key={m}
                          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-[14px] transition ${
                            fundMethod === m
                              ? "border-accent bg-accent/10 font-medium"
                              : "border-border text-foreground/80"
                          }`}
                        >
                          <input
                            type="radio"
                            name="fund_method"
                            value={m}
                            checked={fundMethod === m}
                            onChange={() => setFundMethod(m)}
                            className="sr-only"
                          />
                          <PaymentIcon method={m} />
                          {METHOD_LABELS[m]}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <Field label={`${METHOD_LABELS[fundMethod]} handle`}>
                    <input
                      name="fund_handle"
                      required={fundOn}
                      maxLength={120}
                      onBlur={(e) => {
                        e.target.value = normalizeHandle(
                          fundMethod,
                          e.target.value,
                        );
                      }}
                      placeholder={METHOD_PLACEHOLDERS[fundMethod]}
                      className={inputClass}
                    />
                    <span className="text-[13px] text-muted">
                      {METHOD_HINTS[fundMethod]}
                    </span>
                  </Field>

                  {fundMode === "split" ? (
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Field label="Each person owes">
                          <input
                            name="fund_share"
                            inputMode="decimal"
                            placeholder="15.00"
                            className={inputClass}
                          />
                        </Field>
                      </div>
                      <div className="flex-1">
                        <Field label="How many people">
                          <input
                            name="fund_headcount"
                            inputMode="numeric"
                            placeholder="8"
                            className={inputClass}
                          />
                        </Field>
                      </div>
                    </div>
                  ) : (
                    /* Reimburse and goal both just need a total — people chip
                       in what they can until it's met. */
                    <Field
                      label={fundMode === "reimburse" ? "Total spent" : "Target"}
                    >
                      <input
                        name="fund_total"
                        inputMode="decimal"
                        placeholder="120.00"
                        className={inputClass}
                      />
                    </Field>
                  )}

                  <p className="text-[13px] leading-[1.5] text-muted">
                    Don&rsquo;t know the numbers yet? Leave them blank — you can
                    add them from the manage page once you do. Nobody sees a
                    payment button until then.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        <Section
          step={4}
          title="Your email"
          subtitle="We'll email you a link to manage this event. No account, no password."
        >
          <Field label="Email">
            <input
              name="creator_email"
              type="email"
              required
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
        </Section>

        {/* Preview on small screens, opt-in so it never buries the form. */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setShowMobilePreview((v) => !v)}
            aria-expanded={showMobilePreview}
            aria-controls="mobile-preview"
            className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-dashed border-border px-4 text-left text-[14px] text-foreground/80 transition active:scale-[0.99]"
          >
            {showMobilePreview ? "Hide preview" : "Preview what people will see"}
            <svg
              viewBox="0 0 20 20"
              aria-hidden
              className={`size-4 shrink-0 text-muted transition-transform duration-200 ${
                showMobilePreview ? "rotate-180" : ""
              }`}
            >
              <path
                d="M5 7.5L10 12.5L15 7.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <AnimatePresence initial={false}>
            {showMobilePreview && (
              <motion.div
                id="mobile-preview"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={panelTransition}
                className="overflow-hidden"
              >
                <div className="pt-3">{previewCard}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {state && !state.ok && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 outline-none dark:text-red-400"
          >
            {state.error}
          </div>
        )}

        <div className="sticky bottom-0 -mx-6 border-t border-border/50 bg-background/85 px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0 lg:backdrop-blur-none">
          <button
            type="submit"
            disabled={pending}
            className="h-14 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-fg transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create event"}
          </button>
        </div>
      </form>

      {/* Live preview — sticky alongside the form on desktop. */}
      <aside className="hidden lg:block">
        <div className="sticky top-12 flex flex-col gap-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
            Preview
          </p>
          {previewCard}
          <p className="text-[12.5px] leading-[1.5] text-muted/70">
            This is what people will see when you share your link.
          </p>
        </div>
      </aside>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl bg-foreground/[0.04] border border-transparent px-4 py-3 text-[16px] outline-none focus:border-foreground/20 focus:bg-foreground/[0.02] transition placeholder:text-muted";

function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
          <span
            aria-hidden
            className="grid size-5 place-items-center rounded-full bg-foreground/[0.06] text-[11px] tabular-nums text-foreground/70"
          >
            {step}
          </span>
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
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
        {optional && (
          <span className="ml-1 font-normal text-muted">· optional</span>
        )}
      </span>
      {children}
    </label>
  );
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-1 rounded-xl bg-foreground/[0.05] p-1"
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="size-11 rounded-lg transition hover:bg-foreground/10 active:scale-95"
        aria-label="Decrease slots"
      >
        −
      </button>
      <output className="w-10 text-center text-[15px] font-semibold tabular-nums">
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(500, value + 1))}
        className="size-11 rounded-lg transition hover:bg-foreground/10 active:scale-95"
        aria-label="Increase slots"
      >
        +
      </button>
    </div>
  );
}
