"use client";

import { useState, useTransition } from "react";
import {
  addSheetColumn,
  addSheetNames,
  removeSheetColumn,
  removeSheetRow,
  renameSheetColumn,
  renameSheetRow,
} from "./actions";
import { LABEL_MAX, MAX_COLUMNS, NAME_MAX } from "@/lib/sheet";

type Column = { id: string; label: string; count: number };
type Row = {
  id: string;
  name: string;
  note: string | null;
  selfAdded: boolean;
  /** Labels of the columns this person ticked. */
  ticked: string[];
};

const inputClass =
  "w-full min-w-0 rounded-xl bg-foreground/[0.04] border border-transparent px-3.5 py-2.5 text-[15px] outline-none focus:border-foreground/20 focus:bg-foreground/[0.02] transition placeholder:text-muted";

/**
 * Organizer controls for a contribution sheet. Ticking happens on the public
 * page, same as everyone else; this is for shaping the sheet and tidying it.
 */
export function SheetAdmin({
  token,
  columns,
  rows,
}: {
  token: string;
  columns: Column[];
  rows: Row[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /** Runs an action, shows its error, and calls `after` if it worked. */
  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    after?: () => void,
  ) {
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
      else after?.();
    });
  }

  const pitchedIn = rows.filter((r) => r.ticked.length > 0).length;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-foreground/[0.05] px-3 py-2 text-sm text-foreground/80">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <h3 className="text-[15px] font-semibold">Columns</h3>
        <ul className="flex flex-col gap-2">
          {columns.map((c) => (
            <ColumnItem
              key={`${c.id}:${c.label}`}
              column={c}
              canRemove={columns.length > 1}
              pending={pending}
              onRename={(label) => run(() => renameSheetColumn(token, c.id, label))}
              onRemove={() => run(() => removeSheetColumn(token, c.id))}
            />
          ))}
        </ul>
        {columns.length < MAX_COLUMNS && (
          <AddColumn
            pending={pending}
            onAdd={(label, done) => run(() => addSheetColumn(token, label), done)}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[15px] font-semibold">People</h3>
          <span className="text-[13px] text-muted tabular-nums">
            {pitchedIn} of {rows.length} have ticked something
          </span>
        </div>

        {rows.length > 0 ? (
          <ul className="divide-y divide-border rounded-xl bg-foreground/[0.025]">
            {rows.map((r) => (
              <RowItem
                key={`${r.id}:${r.name}`}
                row={r}
                pending={pending}
                onRename={(name) => run(() => renameSheetRow(token, r.id, name))}
                onRemove={() => run(() => removeSheetRow(token, r.id))}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">
            No names yet. Add some below, or share the link and people can add
            themselves.
          </p>
        )}

        <AddNames
          pending={pending}
          onAdd={(text, done) => {
            setError(null);
            setNotice(null);
            start(async () => {
              const res = await addSheetNames(token, text);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              done();
              if (res.skipped) {
                setNotice(
                  `${res.skipped} already on the sheet, so ${res.skipped === 1 ? "that one was" : "those were"} skipped.`,
                );
              }
            });
          }}
        />
      </div>
    </div>
  );
}

function ColumnItem({
  column,
  canRemove,
  pending,
  onRename,
  onRemove,
}: {
  column: Column;
  canRemove: boolean;
  pending: boolean;
  onRename: (label: string) => void;
  onRemove: () => void;
}) {
  const [value, setValue] = useState(column.label);
  const [confirming, setConfirming] = useState(false);

  function commit() {
    const next = value.trim();
    if (!next) setValue(column.label);
    else if (next !== column.label) onRename(next);
  }

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          maxLength={LABEL_MAX}
          aria-label={`Rename column ${column.label}`}
          className={inputClass}
        />
        <span className="w-16 shrink-0 text-right text-[13px] text-muted tabular-nums">
          {column.count} ticked
        </span>
        {canRemove && !confirming && (
          <button
            type="button"
            onClick={() => (column.count > 0 ? setConfirming(true) : onRemove())}
            disabled={pending}
            aria-label={`Remove column ${column.label}`}
            className="size-10 shrink-0 rounded-lg text-muted transition hover:bg-foreground/5 disabled:opacity-60"
          >
            ✕
          </button>
        )}
      </div>
      {confirming && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-red-500/10 px-3 py-2">
          <span className="text-[13px] text-red-600 dark:text-red-400">
            Remove &ldquo;{column.label}&rdquo; and its {column.count}{" "}
            {column.count === 1 ? "tick" : "ticks"}?
          </span>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-8 rounded-lg bg-foreground/[0.06] px-3 text-[13px]"
            >
              Keep
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onRemove}
              className="h-8 rounded-lg bg-red-500 px-3 text-[13px] text-white disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function AddColumn({
  pending,
  onAdd,
}: {
  pending: boolean;
  onAdd: (label: string, done: () => void) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onAdd(value, () => setValue(""));
      }}
      className="flex items-center gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={LABEL_MAX}
        placeholder="Add a column, e.g. Drinks"
        aria-label="New column name"
        className={inputClass}
      />
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className="h-10 shrink-0 rounded-xl bg-foreground/[0.06] px-4 text-[14px] font-medium transition hover:bg-foreground/10 disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}

function RowItem({
  row,
  pending,
  onRename,
  onRemove,
}: {
  row: Row;
  pending: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.name);

  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setEditing(false);
              if (value.trim() && value.trim() !== row.name) onRename(value);
              else setValue(row.name);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setValue(row.name);
                  setEditing(false);
                }
              }}
              maxLength={NAME_MAX}
              autoFocus
              aria-label={`Rename ${row.name}`}
              className={inputClass}
            />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-xl bg-foreground/[0.06] px-3 text-[13px] font-medium"
            >
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Fix the spelling"
            className="flex max-w-full items-center gap-2 text-left"
          >
            <span className="truncate text-[15px] font-medium">{row.name}</span>
            {row.selfAdded && (
              <span className="shrink-0 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-muted">
                added themselves
              </span>
            )}
          </button>
        )}
        <p className="mt-0.5 text-[13px] text-muted">
          {row.ticked.length > 0 ? row.ticked.join(" · ") : "Nothing ticked yet"}
        </p>
        {row.note && (
          <p className="mt-0.5 text-[13px] text-foreground/80">&ldquo;{row.note}&rdquo;</p>
        )}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={onRemove}
        aria-label={`Remove ${row.name}`}
        className="size-8 shrink-0 rounded-lg text-muted hover:bg-foreground/5 disabled:opacity-60"
      >
        ✕
      </button>
    </li>
  );
}

function AddNames({
  pending,
  onAdd,
}: {
  pending: boolean;
  onAdd: (text: string, done: () => void) => void;
}) {
  const [text, setText] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onAdd(text, () => setText(""));
      }}
      className="flex flex-col gap-2"
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Add names</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={"One per line, or paste a list"}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={pending || !text.trim()}
        className="h-11 rounded-xl bg-accent text-[15px] font-semibold text-accent-fg transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add to sheet"}
      </button>
    </form>
  );
}
