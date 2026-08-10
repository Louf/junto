"use client";

import { useState } from "react";
import { Drawer } from "vaul";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/style.css";

type Props = {
  value: Date | null;
  onChange: (d: Date) => void;
  placeholder?: string;
  minDate?: Date;
};

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date & time",
  minDate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(value);

  function commit() {
    if (draft) onChange(draft);
    setOpen(false);
  }

  function openSheet() {
    setDraft(value ?? defaultStart(minDate));
    setOpen(true);
  }

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={openSheet}
        className="flex h-12 w-full items-center justify-between rounded-xl bg-foreground/[0.05] px-4 text-left text-[16px] outline-none active:scale-[0.99] transition"
      >
        <span className={value ? "" : "text-muted"}>
          {value
            ? `${format(value, "EEE, MMM d")} · ${format(value, "h:mm a")}`
            : placeholder}
        </span>
        <span className="text-muted">›</span>
      </button>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex flex-col rounded-t-3xl bg-background outline-none">
          <Drawer.Title className="sr-only">Pick a date & time</Drawer.Title>
          <div className="mx-auto mt-3 mb-2 h-1.5 w-10 rounded-full bg-foreground/15" />
          <div className="px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-2">
            <div className="flex items-center justify-between px-2 pb-2">
              <h3 className="text-[18px] font-semibold">When?</h3>
              <span className="text-[14px] text-muted tabular-nums">
                {draft
                  ? `${format(draft, "EEE, MMM d")} · ${format(draft, "h:mm a")}`
                  : "—"}
              </span>
            </div>

            <div className="flex justify-center">
              <DayPicker
                mode="single"
                selected={draft ?? undefined}
                onSelect={(d) =>
                  setDraft((prev) => mergeDate(d ?? null, prev))
                }
                disabled={minDate ? { before: minDate } : undefined}
                showOutsideDays
                weekStartsOn={0}
                classNames={dpClassNames}
              />
            </div>

            <TimeControls
              value={draft}
              onChange={(t) => setDraft((prev) => mergeTime(prev, t))}
            />

            <button
              type="button"
              onClick={commit}
              disabled={!draft}
              className="mt-5 h-14 w-full rounded-2xl bg-accent text-accent-fg text-[17px] font-semibold disabled:opacity-60 active:scale-[0.98] transition"
            >
              Done
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function defaultStart(min?: Date) {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  if (min && d < min) return min;
  return d;
}

function mergeDate(day: Date | null, prev: Date | null): Date | null {
  if (!day) return prev;
  const base = prev ?? new Date();
  const next = new Date(day);
  next.setHours(base.getHours(), base.getMinutes(), 0, 0);
  return next;
}

function mergeTime(prev: Date | null, t: { h: number; m: number }): Date | null {
  const base = prev ?? new Date();
  const next = new Date(base);
  next.setHours(t.h, t.m, 0, 0);
  return next;
}

function TimeControls({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (t: { h: number; m: number }) => void;
}) {
  const h24 = value ? value.getHours() : 9;
  const m = value ? value.getMinutes() : 0;
  const pm = h24 >= 12;
  const h12 = ((h24 + 11) % 12) + 1;

  function setH12(next: number) {
    const wrapped = ((next - 1 + 12) % 12) + 1;
    const newH24 = (wrapped % 12) + (pm ? 12 : 0);
    onChange({ h: newH24, m });
  }
  function setM(next: number) {
    const wrapped = ((next % 60) + 60) % 60;
    onChange({ h: h24, m: wrapped });
  }
  function togglePm() {
    const newH24 = pm ? h24 - 12 : h24 + 12;
    onChange({ h: (newH24 + 24) % 24, m });
  }

  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <NumberSpinner
        label="Hour"
        value={h12}
        onInc={() => setH12(h12 + 1)}
        onDec={() => setH12(h12 - 1)}
        display={String(h12)}
      />
      <span className="text-[28px] font-semibold pb-1">:</span>
      <NumberSpinner
        label="Min"
        value={m}
        onInc={() => setM(m + 5)}
        onDec={() => setM(m - 5)}
        display={String(m).padStart(2, "0")}
      />
      <button
        type="button"
        onClick={togglePm}
        aria-label="Toggle AM/PM"
        className="ml-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.05] text-[15px] font-semibold active:scale-95 transition"
      >
        {pm ? "PM" : "AM"}
      </button>
    </div>
  );
}

function NumberSpinner({
  label,
  display,
  onInc,
  onDec,
}: {
  label: string;
  value: number;
  display: string;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onInc}
        aria-label={`Increase ${label}`}
        className="h-8 w-14 rounded-lg text-muted hover:bg-foreground/5 active:scale-90 transition"
      >
        ▲
      </button>
      <div className="w-14 rounded-xl bg-foreground/[0.05] text-center py-2 text-[24px] font-semibold tabular-nums leading-none">
        {display}
      </div>
      <button
        type="button"
        onClick={onDec}
        aria-label={`Decrease ${label}`}
        className="h-8 w-14 rounded-lg text-muted hover:bg-foreground/5 active:scale-90 transition"
      >
        ▼
      </button>
    </div>
  );
}

const dpClassNames: Partial<Record<string, string>> = {
  root: "rdp text-[15px]",
  months: "flex flex-col gap-2",
  month: "flex flex-col gap-2",
  month_caption: "flex items-center justify-center h-10 text-[15px] font-semibold",
  caption_label: "px-2",
  nav: "absolute top-1 left-0 right-0 flex justify-between px-1 pointer-events-none",
  button_previous:
    "pointer-events-auto h-8 w-8 rounded-lg text-foreground/80 hover:bg-foreground/5 active:scale-95 transition flex items-center justify-center",
  button_next:
    "pointer-events-auto h-8 w-8 rounded-lg text-foreground/80 hover:bg-foreground/5 active:scale-95 transition flex items-center justify-center",
  month_grid: "w-full border-collapse",
  weekdays: "grid grid-cols-7",
  weekday:
    "text-[12px] font-medium uppercase tracking-wider text-muted text-center py-1",
  week: "grid grid-cols-7",
  day: "p-0.5 text-center",
  day_button:
    "h-10 w-10 rounded-full text-[15px] font-medium hover:bg-foreground/10 active:scale-90 transition mx-auto flex items-center justify-center",
  today: "font-bold text-accent",
  selected:
    "[&_button]:bg-accent [&_button]:text-accent-fg [&_button]:hover:bg-accent",
  outside: "text-foreground/30",
  disabled: "opacity-30 pointer-events-none",
};
