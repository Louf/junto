"use client";

import {
  Fragment,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { motion } from "framer-motion";
import { addSheetRow, setRowNote, setTick } from "./actions";
import { NAME_MAX, NOTE_MAX, nameKey } from "@/lib/sheet";

type Column = { id: string; label: string };
type Row = { id: string; name: string; note: string | null; ticks: string[] };

type Change =
  | { type: "tick"; rowId: string; columnId: string; ticked: boolean }
  | { type: "note"; rowId: string; note: string | null };

function applyChange(rows: Row[], c: Change): Row[] {
  return rows.map((r) => {
    if (r.id !== c.rowId) return r;
    if (c.type === "note") return { ...r, note: c.note };
    const ticks = r.ticks.filter((id) => id !== c.columnId);
    return { ...r, ticks: c.ticked ? [...ticks, c.columnId] : ticks };
  });
}

/** Below this, scrolling is quicker than typing. */
const SEARCH_FROM = 8;

/**
 * Whether the grid fits a phone without sideways scrolling, where a column
 * off the edge is easy to miss entirely. Judged from the data rather than the
 * screen so the server and the browser render the same markup.
 */
function fitsPhone(columns: Column[]) {
  return columns.length <= 3 && columns.every((c) => c.label.length <= 8);
}

/**
 * The public contribution sheet: every name down the side, every way to help
 * across the top. Ticks show immediately and save in the background; if a save
 * fails, the box springs back and the error says why.
 */
export function SheetTable({
  eventId,
  columns,
  rows,
  closed = false,
}: {
  eventId: string;
  columns: Column[];
  rows: Row[];
  /** Cancelled event — show the sheet, take away the controls. */
  closed?: boolean;
}) {
  const [shown, apply] = useOptimistic(rows, applyChange);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);


  const q = nameKey(query);
  const visible = q ? shown.filter((r) => nameKey(r.name).includes(q)) : shown;

  function toggle(row: Row, column: Column, ticked: boolean) {
    setError(null);
    startTransition(async () => {
      apply({ type: "tick", rowId: row.id, columnId: column.id, ticked });
      const res = await setTick(row.id, column.id, ticked);
      if (!res.ok) setError(res.error);
    });
  }

  function saveNote(row: Row, note: string) {
    setError(null);
    setEditing(null);
    startTransition(async () => {
      apply({ type: "note", rowId: row.id, note: note.trim() || null });
      const res = await setRowNote(row.id, note);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card">
      {rows.length >= SEARCH_FROM && (
        <div className="border-b border-border p-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find your name"
            aria-label="Find your name"
            className="w-full rounded-xl bg-foreground/[0.05] px-4 py-2.5 text-[16px] outline-none transition placeholder:text-muted focus:bg-foreground/[0.02] focus:ring-2 focus:ring-foreground/15"
          />
        </div>
      )}

      {/* Too wide for a phone: one card per person instead, every option visible. */}
      {!fitsPhone(columns) && (
        <div className="sm:hidden">
          <ul>
            {visible.map((row) => (
              <li
                key={row.id}
                className="border-t border-border px-4 py-3 first:border-t-0"
              >
                <span className="block text-[15px] font-medium leading-snug break-words">
                  {row.name}
                </span>
                <NoteLine
                  row={row}
                  closed={closed}
                  onEdit={() => setEditing(row.id)}
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {columns.map((c) => (
                    <TickChip
                      key={c.id}
                      label={c.label}
                      name={row.name}
                      checked={row.ticks.includes(c.id)}
                      disabled={closed}
                      onChange={(v) => toggle(row, c, v)}
                    />
                  ))}
                </div>
                {editing === row.id && (
                  <div className="mt-3">
                    <NoteEditor
                      name={row.name}
                      initial={row.note ?? ""}
                      onSave={(n) => saveNote(row, n)}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`overflow-x-auto ${fitsPhone(columns) ? "" : "hidden sm:block"}`}
      >
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 bg-card px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted"
              >
                Name
              </th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  // Sized to the label, and the last column mirrors the Name
                  // column's inset so nothing runs into the rounded corner.
                  className="min-w-15 px-2 py-3 text-center align-bottom last:pr-4"
                >
                  <span className="mx-auto block max-w-28 truncate whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {c.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <Fragment key={row.id}>
                <tr>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 min-w-28 border-t border-border bg-card px-4 py-2.5 align-middle font-normal"
                  >
                    <span className="block text-[15px] font-medium leading-snug break-words">
                      {row.name}
                    </span>
                    <NoteLine
                      row={row}
                      closed={closed}
                      onEdit={() => setEditing(row.id)}
                    />
                  </th>
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className="border-t border-border px-2 py-1 text-center last:pr-4"
                    >
                      <TickBox
                        label={`${row.name}: ${c.label}`}
                        checked={row.ticks.includes(c.id)}
                        disabled={closed}
                        onChange={(v) => toggle(row, c, v)}
                      />
                    </td>
                  ))}
                </tr>
                {editing === row.id && (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="bg-foreground/[0.02] px-4 pb-3 pt-1"
                    >
                      <NoteEditor
                        name={row.name}
                        initial={row.note ?? ""}
                        onSave={(n) => saveNote(row, n)}
                        onCancel={() => setEditing(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && (
        <p className="border-t border-border px-4 py-6 text-center text-[14px] text-muted">
          No names yet.{closed ? "" : " Add yours below."}
        </p>
      )}
      {shown.length > 0 && visible.length === 0 && (
        <p className="border-t border-border px-4 py-6 text-center text-[14px] text-muted">
          No one called &ldquo;{query.trim()}&rdquo; yet.
          {closed ? "" : " Add yourself below."}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mx-3 mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {!closed && (
        <AddYourself
          eventId={eventId}
          columns={columns}
          suggestedName={visible.length === 0 ? query.trim() : ""}
          onAdded={() => setQuery("")}
        />
      )}
    </div>
  );
}

function NoteLine({
  row,
  closed,
  onEdit,
}: {
  row: Row;
  closed: boolean;
  onEdit: () => void;
}) {
  if (row.note) {
    return closed ? (
      <span className="mt-0.5 block text-[13px] leading-snug text-muted">
        {row.note}
      </span>
    ) : (
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit note for ${row.name}: ${row.note}`}
        className="mt-0.5 block text-left text-[13px] leading-snug text-muted transition hover:text-foreground"
      >
        {row.note}
      </button>
    );
  }

  // Only nudge for a note once someone has ticked something — on every row it
  // would just be noise.
  if (closed || row.ticks.length === 0) return null;
  return (
    <button
      type="button"
      onClick={onEdit}
      className="mt-0.5 block text-[12.5px] font-medium text-accent transition hover:underline"
    >
      + Add a note
    </button>
  );
}

function TickBox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`relative mx-auto grid size-11 place-items-center ${
        disabled ? "" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer size-7 appearance-none rounded-lg border-2 border-foreground/20 bg-background transition checked:border-accent checked:bg-accent hover:border-foreground/35 checked:hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60"
      />
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="pointer-events-none absolute size-4 text-accent-fg opacity-0 transition peer-checked:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
      </svg>
    </label>
  );
}

/** The phone layout's checkbox: a pill with the column's name on it. */
function TickChip({
  label,
  name,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50 ${
        checked
          ? "border-accent bg-accent text-accent-fg"
          : "border-border text-foreground/80"
      } ${disabled ? "opacity-60" : "cursor-pointer active:scale-[0.97]"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={`${name}: ${label}`}
        className="sr-only"
      />
      {checked ? (
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      ) : (
        <span
          aria-hidden
          className="size-3.5 rounded-[4px] border-[1.5px] border-foreground/30"
        />
      )}
      {label}
    </label>
  );
}

function NoteEditor({
  name,
  initial,
  onSave,
  onCancel,
}: {
  name: string;
  initial: string;
  onSave: (note: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={NOTE_MAX}
        placeholder="e.g. Lasagna for 10"
        aria-label={`Note for ${name}`}
        className="min-w-0 flex-1 rounded-xl bg-foreground/[0.05] px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-muted focus:bg-foreground/[0.02] focus:ring-2 focus:ring-foreground/15"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-xl px-3.5 text-[14px] font-medium text-muted transition hover:bg-foreground/5 hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-fg transition active:scale-[0.98]"
        >
          Save
        </button>
      </div>
    </form>
  );
}

function AddYourself({
  eventId,
  columns,
  suggestedName,
  onAdded,
}: {
  eventId: string;
  columns: Column[];
  /** What they searched for and didn't find, so they don't type it twice. */
  suggestedName: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    setError(null);
    startTransition(async () => {
      const res = await addSheetRow(eventId, {
        name,
        note: String(fd.get("note") ?? ""),
        columnIds: picked,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(name.trim());
      setPicked([]);
      setOpen(false);
      onAdded();
    });
  }

  return (
    <div className="border-t border-border p-3">
      {done && !open && (
        <p className="mb-3 rounded-xl bg-success/15 px-3 py-2 text-sm text-success">
          You&rsquo;re on the sheet, {done}.
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setOpen(true);
          }}
          className="h-11 w-full rounded-2xl border border-dashed border-border text-[14px] text-foreground/80 transition hover:bg-foreground/5 active:scale-[0.99]"
        >
          Not on the list? Add your name
        </button>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={submit}
          className="flex flex-col gap-3 p-1"
        >
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Your name</span>
            <input
              name="name"
              required
              maxLength={NAME_MAX}
              defaultValue={suggestedName}
              autoComplete="name"
              autoFocus
              placeholder="Pat Smith"
              className="w-full rounded-xl bg-foreground/[0.05] px-3.5 py-2.5 text-[16px] outline-none transition placeholder:text-muted focus:bg-foreground/[0.02] focus:ring-2 focus:ring-foreground/15"
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              What can you do?
            </legend>
            <div className="flex flex-wrap gap-2">
              {columns.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-[14px] transition ${
                      on
                        ? "border-accent bg-accent/10 font-medium"
                        : "border-border text-foreground/80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) =>
                        setPicked((p) =>
                          e.target.checked
                            ? [...p, c.id]
                            : p.filter((id) => id !== c.id),
                        )
                      }
                      className="size-4 accent-[var(--accent)]"
                    />
                    {c.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              Note <span className="font-normal text-muted">· optional</span>
            </span>
            <input
              name="note"
              maxLength={NOTE_MAX}
              placeholder="e.g. Lasagna for 10"
              className="w-full rounded-xl bg-foreground/[0.05] px-3.5 py-2.5 text-[16px] outline-none transition placeholder:text-muted focus:bg-foreground/[0.02] focus:ring-2 focus:ring-foreground/15"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="h-11 rounded-xl px-4 text-[15px] font-medium text-muted transition hover:bg-foreground/5 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="h-11 rounded-xl bg-accent px-5 text-[15px] font-semibold text-accent-fg transition active:scale-[0.98] disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add me"}
            </button>
          </div>
        </motion.form>
      )}
    </div>
  );
}
