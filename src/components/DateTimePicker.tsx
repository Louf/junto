"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * A bottom sheet is right on a phone and wrong on a laptop, so this renders
 * both and lets CSS pick: a vaul drawer under `md`, an anchored popover above.
 *
 * The choice is made with CSS rather than a matchMedia hook on purpose — a
 * JS-driven branch would render differently on the server than on the client
 * and trip a hydration mismatch. Only one is ever visible, and `display: none`
 * takes the other out of the tab order.
 */
export function DateTimePicker(props: Props) {
  return (
    <>
      <div className="md:hidden">
        <SheetPicker {...props} />
      </div>
      <div className="hidden md:block">
        <PopoverPicker {...props} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile: bottom sheet                                                */
/* ------------------------------------------------------------------ */

function SheetPicker({ value, onChange, placeholder, minDate }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(value);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Trigger
        value={value}
        placeholder={placeholder}
        onClick={() => {
          setDraft(value ?? defaultStart(minDate));
          setOpen(true);
        }}
      />

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mt-24 flex flex-col rounded-t-3xl bg-background outline-none">
          <Drawer.Title className="sr-only">Pick a date &amp; time</Drawer.Title>
          <div className="mx-auto mt-3 mb-2 h-1.5 w-10 rounded-full bg-foreground/15" />
          <div className="px-4 pb-[max(env(safe-area-inset-bottom),20px)] pt-2">
            <div className="flex items-center justify-between px-2 pb-2">
              <h3 className="text-[18px] font-semibold">When?</h3>
              <span className="text-[14px] text-muted tabular-nums">
                {draft ? formatValue(draft) : "—"}
              </span>
            </div>

            <PickerBody draft={draft} setDraft={setDraft} minDate={minDate} />

            <button
              type="button"
              onClick={() => {
                if (draft) onChange(draft);
                setOpen(false);
              }}
              disabled={!draft}
              className="mt-5 h-14 w-full rounded-2xl bg-accent text-[17px] font-semibold text-accent-fg transition active:scale-[0.98] disabled:opacity-60"
            >
              Done
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop: anchored popover                                           */
/* ------------------------------------------------------------------ */

function PopoverPicker({ value, onChange, placeholder, minDate }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  // Dismiss on outside click or Escape — a popover that only closes via its
  // own button feels stuck.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Move focus into the panel so keyboard users aren't left behind the trigger.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <Trigger
        ref={triggerRef}
        value={value}
        placeholder={placeholder}
        expanded={open}
        onClick={() => {
          if (open) return close(false);
          setDraft(value ?? defaultStart(minDate));
          setOpen(true);
        }}
      />

      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Pick a date and time"
          className="absolute left-0 top-full z-50 mt-2 w-[330px] rounded-2xl border border-border bg-card p-4 shadow-lg outline-none"
        >
          <PickerBody draft={draft} setDraft={setDraft} minDate={minDate} compact />

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-[13px] text-muted tabular-nums">
              {draft ? formatValue(draft) : "—"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => close()}
                className="h-9 rounded-xl px-3 text-[14px] text-muted transition hover:bg-foreground/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (draft) onChange(draft);
                  close();
                }}
                disabled={!draft}
                className="h-9 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-fg transition active:scale-[0.98] disabled:opacity-60"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function Trigger({
  ref,
  value,
  placeholder = "Pick a date & time",
  expanded,
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  value: Date | null;
  placeholder?: string;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-haspopup={expanded === undefined ? undefined : "dialog"}
      aria-expanded={expanded}
      className="flex h-12 w-full items-center justify-between rounded-xl bg-foreground/[0.05] px-4 text-left text-[16px] outline-none transition active:scale-[0.99]"
    >
      <span className={value ? "" : "text-muted"}>
        {value ? formatValue(value) : placeholder}
      </span>
      <span className="text-muted">›</span>
    </button>
  );
}

function PickerBody({
  draft,
  setDraft,
  minDate,
  compact = false,
}: {
  draft: Date | null;
  setDraft: React.Dispatch<React.SetStateAction<Date | null>>;
  minDate?: Date;
  compact?: boolean;
}) {
  return (
    <>
      <div className="flex justify-center">
        <DayPicker
          mode="single"
          selected={draft ?? undefined}
          onSelect={(d) => setDraft((prev) => mergeDate(d ?? null, prev))}
          disabled={minDate ? { before: minDate } : undefined}
          showOutsideDays
          weekStartsOn={0}
          classNames={compact ? dpCompactClassNames : dpClassNames}
        />
      </div>

      <TimeControls
        value={draft}
        compact={compact}
        onChange={(t) => setDraft((prev) => mergeTime(prev, t))}
      />
    </>
  );
}

function formatValue(d: Date) {
  return `${format(d, "EEE, MMM d")} · ${format(d, "h:mm a")}`;
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
  compact = false,
}: {
  value: Date | null;
  onChange: (t: { h: number; m: number }) => void;
  compact?: boolean;
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
    <div
      className={`flex items-center justify-center gap-2 ${compact ? "mt-1" : "mt-3"}`}
    >
      <NumberSpinner
        label="Hour"
        compact={compact}
        onInc={() => setH12(h12 + 1)}
        onDec={() => setH12(h12 - 1)}
        display={String(h12)}
      />
      <span className={`pb-1 font-semibold ${compact ? "text-[20px]" : "text-[28px]"}`}>
        :
      </span>
      <NumberSpinner
        label="Min"
        compact={compact}
        onInc={() => setM(m + 5)}
        onDec={() => setM(m - 5)}
        display={String(m).padStart(2, "0")}
      />
      <button
        type="button"
        onClick={togglePm}
        aria-label="Toggle AM/PM"
        className={`ml-2 flex items-center justify-center rounded-2xl bg-foreground/[0.05] font-semibold transition active:scale-95 ${
          compact ? "h-10 w-12 text-[13px]" : "h-14 w-14 text-[15px]"
        }`}
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
  compact = false,
}: {
  label: string;
  display: string;
  onInc: () => void;
  onDec: () => void;
  compact?: boolean;
}) {
  const arrow = compact
    ? "h-6 w-12 rounded-lg text-[11px] text-muted transition hover:bg-foreground/5 active:scale-90"
    : "h-8 w-14 rounded-lg text-muted transition hover:bg-foreground/5 active:scale-90";
  const readout = compact
    ? "w-12 rounded-lg bg-foreground/[0.05] py-1.5 text-center text-[18px] font-semibold leading-none tabular-nums"
    : "w-14 rounded-xl bg-foreground/[0.05] py-2 text-center text-[24px] font-semibold leading-none tabular-nums";

  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={onInc} aria-label={`Increase ${label}`} className={arrow}>
        ▲
      </button>
      <output className={readout}>{display}</output>
      <button type="button" onClick={onDec} aria-label={`Decrease ${label}`} className={arrow}>
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

/** Same calendar, tightened for a popover rather than a full-width sheet. */
const dpCompactClassNames: Partial<Record<string, string>> = {
  ...dpClassNames,
  root: "rdp text-[14px]",
  month_caption: "flex items-center justify-center h-8 text-[14px] font-semibold",
  weekday:
    "text-[11px] font-medium uppercase tracking-wider text-muted text-center py-0.5",
  day: "p-0 text-center",
  day_button:
    "h-8 w-8 rounded-full text-[13px] font-medium hover:bg-foreground/10 active:scale-90 transition mx-auto flex items-center justify-center",
};
