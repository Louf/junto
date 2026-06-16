"use client";

import { useState, useTransition } from "react";
import { addJob } from "./actions";

export function AddJobForm({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await addJob(token, fd);
      if (res.ok) {
        (e.target as HTMLFormElement).reset();
        setOpen(false);
      } else setError(res.error);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-12 w-full rounded-2xl border border-dashed border-border text-foreground/80 hover:bg-foreground/5 active:scale-[0.99] transition"
      >
        + Add a job
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3"
    >
      <input
        name="title"
        required
        placeholder="Job title"
        className="w-full rounded-xl bg-foreground/[0.05] px-4 py-3 text-[16px] outline-none"
      />
      <textarea
        name="description"
        rows={2}
        placeholder="Optional details"
        className="w-full rounded-xl bg-foreground/[0.05] px-4 py-3 text-[15px] outline-none"
      />
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted">Slots</label>
        <input
          name="capacity"
          type="number"
          min={1}
          max={500}
          defaultValue={1}
          className="w-20 text-center rounded-xl bg-foreground/[0.05] px-3 py-2 text-[15px] outline-none"
        />
      </div>
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 h-11 rounded-xl bg-foreground/[0.05] text-[15px] active:scale-[0.98] transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 h-11 rounded-xl bg-accent text-accent-fg text-[15px] font-semibold disabled:opacity-60 active:scale-[0.98] transition"
        >
          {pending ? "Adding…" : "Add job"}
        </button>
      </div>
    </form>
  );
}
