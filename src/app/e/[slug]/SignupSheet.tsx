"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
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
  const [pending, startTransition] = useTransition();
  const [state, action] = useActionState<SignupState | null, FormData>(
    claimSlot,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(() => setOpen(false), 900);
      return () => clearTimeout(t);
    }
  }, [state]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("job_id", job.id);
    startTransition(() => action(fd));
  }

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
            {state?.ok ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center py-10 text-center"
              >
                <div className="h-14 w-14 rounded-full bg-success/15 flex items-center justify-center text-success text-2xl">
                  ✓
                </div>
                <p className="mt-4 text-lg font-semibold">You&rsquo;re in</p>
                <p className="text-muted text-sm mt-1">
                  Check your inbox for confirmation.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
                <Input
                  label="Your name"
                  name="name"
                  required
                  placeholder="Pat Smith"
                  autoComplete="name"
                />
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  required
                  placeholder="pat@example.com"
                  autoComplete="email"
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
                    className="w-full rounded-xl bg-foreground/[0.05] px-4 py-3 text-[16px] outline-none focus:bg-foreground/[0.02] focus:ring-2 focus:ring-foreground/15 transition"
                  />
                </label>

                {state && !state.ok && (
                  <div className="rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 text-sm">
                    {state.error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-1 h-14 rounded-2xl bg-accent text-accent-fg text-[17px] font-semibold disabled:opacity-60 active:scale-[0.98] transition"
                >
                  {pending ? "Claiming…" : "Claim slot"}
                </button>
              </form>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl bg-foreground/[0.05] px-4 py-3 text-[16px] outline-none focus:bg-foreground/[0.02] focus:ring-2 focus:ring-foreground/15 transition"
      />
    </label>
  );
}
