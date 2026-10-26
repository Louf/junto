"use client";

import {
  useState,
  useTransition,
  useActionState,
  useEffect,
  useCallback,
} from "react";
import { Drawer } from "vaul";
import { motion } from "framer-motion";
import { claimSlot, type SignupState } from "./actions";

type Job = {
  id: string;
  title: string;
  description: string | null;
  capacity: number;
  filled: number;
};

/** Mobile: the signup form in a bottom sheet, opened by tapping the card. */
export function SignupSheet({
  job,
  children,
  disabled,
}: {
  job: Job;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Stable, so the form's close-after-success timer isn't reset by re-renders.
  const close = useCallback(() => setOpen(false), []);

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <Drawer.Trigger asChild disabled={disabled}>
        {children}
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex flex-col rounded-t-3xl bg-background outline-none">
          <Drawer.Title className="sr-only">
            Sign up for {job.title}
          </Drawer.Title>
          <div className="mx-auto mt-3 mb-2 h-1.5 w-10 rounded-full bg-foreground/15" />
          <div className="px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-2">
            <SignupForm job={job} onDone={close} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * The form itself, shared by the mobile sheet and the desktop card that
 * expands in place. It mounts fresh each time it opens, so a past success or
 * error never greets the next visit.
 *
 * `inline` drops the heading (the card above already shows the job) and
 * tightens the controls to sit inside a card rather than fill a sheet.
 */
export function SignupForm({
  job,
  onDone,
  inline = false,
}: {
  job: Job;
  onDone: () => void;
  inline?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, action] = useActionState<SignupState | null, FormData>(
    claimSlot,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onDone, inline ? 1600 : 900);
      return () => clearTimeout(t);
    }
  }, [state, onDone, inline]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("job_id", job.id);
    startTransition(() => action(fd));
  }

  if (state?.ok) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          inline
            ? "flex items-center gap-3 py-1"
            : "flex flex-col items-center py-10 text-center"
        }
      >
        <div
          className={`shrink-0 rounded-full bg-success/15 flex items-center justify-center text-success ${
            inline ? "h-9 w-9 text-lg" : "h-14 w-14 text-2xl"
          }`}
        >
          ✓
        </div>
        <div>
          <p className={`font-semibold ${inline ? "text-[15px]" : "mt-4 text-lg"}`}>
            You&rsquo;re in
          </p>
          <p className={`text-muted text-sm ${inline ? "" : "mt-1"}`}>
            Check your inbox for confirmation.
          </p>
        </div>
      </motion.div>
    );
  }

  const field = inline ? "px-3.5 py-2.5 text-[15px]" : "px-4 py-3 text-[16px]";

  return (
    <form onSubmit={onSubmit} className={`flex flex-col ${inline ? "gap-3" : "gap-4"}`}>
      {!inline && (
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
            {job.filled} of {job.capacity} taken
          </p>
          <h3 className="mt-1 text-[22px] font-semibold leading-tight">
            Claim a slot: {job.title}
          </h3>
          {job.description && (
            <p className="mt-2 text-sm text-muted">{job.description}</p>
          )}
        </div>
      )}
      <Input
        label="Your name"
        name="name"
        required
        placeholder="Pat Smith"
        autoComplete="name"
        autoFocus={inline}
        fieldClass={field}
      />
      <Input
        label="Email"
        name="email"
        type="email"
        required
        placeholder="pat@example.com"
        autoComplete="email"
        fieldClass={field}
      />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          Note <span className="text-muted font-normal">· optional</span>
        </span>
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          placeholder="Anything the organizer should know?"
          className={`w-full rounded-xl bg-foreground/[0.05] outline-none focus:bg-foreground/[0.02] focus:ring-2 focus:ring-foreground/15 transition ${field}`}
        />
      </label>

      {state && !state.ok && (
        <div className="rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 text-sm">
          {state.error}
        </div>
      )}

      {inline ? (
        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDone}
            className="h-11 rounded-xl px-4 text-[15px] font-medium text-muted transition hover:bg-foreground/5 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-xl bg-accent px-5 text-[15px] font-semibold text-accent-fg transition hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Claiming…" : "Claim slot"}
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="mt-1 h-14 rounded-2xl bg-accent text-accent-fg text-[17px] font-semibold disabled:opacity-60 active:scale-[0.98] transition"
        >
          {pending ? "Claiming…" : "Claim slot"}
        </button>
      )}
    </form>
  );
}

function Input({
  label,
  fieldClass,
  ...props
}: { label: string; fieldClass: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        {...props}
        className={`w-full rounded-xl bg-foreground/[0.05] outline-none focus:bg-foreground/[0.02] focus:ring-2 focus:ring-foreground/15 transition ${fieldClass}`}
      />
    </label>
  );
}
