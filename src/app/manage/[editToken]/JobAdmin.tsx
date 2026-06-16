"use client";

import { useState, useTransition } from "react";
import { removeJob, removeSignup } from "./actions";

type Signup = { id: string; name: string; email: string; note: string | null };

export function JobAdmin({
  token,
  job,
}: {
  token: string;
  job: {
    id: string;
    title: string;
    description: string | null;
    capacity: number;
    signups: Signup[];
  };
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const filled = job.signups.length;
  const full = filled >= job.capacity;

  function doRemoveJob() {
    start(() => removeJob(token, job.id) as unknown as Promise<void>);
  }

  function doRemoveSignup(id: string) {
    start(() => removeSignup(token, id) as unknown as Promise<void>);
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[18px] font-semibold leading-tight truncate">
            {job.title}
          </h3>
          {job.description && (
            <p className="mt-1 text-sm text-muted">{job.description}</p>
          )}
          <p className="mt-1 text-[13px] text-muted tabular-nums">
            {filled} / {job.capacity} {full && "· FULL"}
          </p>
        </div>
        {confirming ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => setConfirming(false)}
              className="h-9 px-3 rounded-lg text-[13px] bg-foreground/[0.06]"
            >
              Cancel
            </button>
            <button
              disabled={pending}
              onClick={doRemoveJob}
              className="h-9 px-3 rounded-lg text-[13px] bg-red-500 text-white disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-[13px] text-muted hover:text-foreground"
          >
            Delete
          </button>
        )}
      </div>

      {job.signups.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl bg-foreground/[0.025]">
          {job.signups.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-[15px] font-medium truncate">{s.name}</div>
                <div className="text-[13px] text-muted truncate">{s.email}</div>
                {s.note && (
                  <div className="text-[13px] text-muted mt-0.5 whitespace-pre-wrap">
                    {s.note}
                  </div>
                )}
              </div>
              <button
                disabled={pending}
                onClick={() => doRemoveSignup(s.id)}
                aria-label="Remove signup"
                className="shrink-0 h-8 w-8 rounded-lg text-muted hover:bg-foreground/5"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">No signups yet.</p>
      )}
    </div>
  );
}
