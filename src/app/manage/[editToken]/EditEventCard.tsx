"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { updateEvent } from "./actions";
import { DateTimePicker } from "@/components/DateTimePicker";

export function EditEventCard({
  token,
  initial,
  bannerUrl,
}: {
  token: string;
  initial: {
    name: string;
    description: string | null;
    event_at: string;
  };
  bannerUrl: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [eventAt, setEventAt] = useState<Date>(new Date(initial.event_at));

  function startEditing() {
    setEventAt(new Date(initial.event_at));
    setEditing(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("event_at", eventAt.toISOString());
    start(async () => {
      const res = await updateEvent(token, fd);
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  if (!editing) {
    const when = new Date(initial.event_at);
    return (
      <div>
        {bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt=""
            className="aspect-[16/9] w-full rounded-2xl object-cover mb-4"
          />
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
              {format(when, "EEEE, MMM d")} · {format(when, "h:mm a")}
            </div>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">
              {initial.name}
            </h1>
            {initial.description && (
              <p className="mt-2 text-[15px] text-foreground/80 whitespace-pre-wrap">
                {initial.description}
              </p>
            )}
          </div>
          <button
            onClick={startEditing}
            className="shrink-0 text-[13px] text-muted hover:text-foreground"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3"
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Name</span>
        <input
          name="name"
          defaultValue={initial.name}
          required
          maxLength={120}
          className="w-full rounded-xl bg-foreground/[0.05] px-4 py-3 text-[16px] outline-none"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Description</span>
        <textarea
          name="description"
          defaultValue={initial.description ?? ""}
          rows={3}
          maxLength={2000}
          className="w-full rounded-xl bg-foreground/[0.05] px-4 py-3 text-[15px] outline-none"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Date &amp; time</span>
        <DateTimePicker value={eventAt} onChange={setEventAt} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          Replace banner{" "}
          <span className="text-muted font-normal">· optional</span>
        </span>
        <input
          name="banner"
          type="file"
          accept="image/*"
          className="block w-full text-sm text-foreground/80 file:mr-3 file:rounded-xl file:border-0 file:bg-foreground/5 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </label>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-1 h-12 rounded-xl bg-foreground/[0.05] text-[15px] active:scale-[0.98] transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 h-12 rounded-xl bg-accent text-accent-fg text-[15px] font-semibold disabled:opacity-60 active:scale-[0.98] transition"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
