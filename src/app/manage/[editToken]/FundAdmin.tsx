"use client";

import { useState, useTransition } from "react";
import {
  saveFund,
  removeFund,
  confirmContribution,
  removeContribution,
} from "./actions";
import {
  formatCents,
  METHOD_HINTS,
  METHOD_LABELS,
  METHOD_PLACEHOLDERS,
  PAYMENT_METHODS,
  normalizeHandle,
  type PaymentMethod,
} from "@/lib/payments";
import { PaymentIcon } from "@/components/PaymentIcon";

type Contribution = {
  id: string;
  name: string;
  amountCents: number;
  confirmed: boolean;
};

type Props = {
  token: string;
  suggestedShareCents: number | null;
  fund: {
    payerName: string;
    /** Null while the organizer still doesn't know what was spent. */
    totalCents: number | null;
    shareCents: number | null;
    method: PaymentMethod;
    handle: string;
    note: string | null;
    contributions: Contribution[];
  } | null;
};

const inputClass =
  "w-full rounded-xl border border-transparent bg-foreground/[0.04] px-4 py-3 text-[16px] outline-none transition placeholder:text-muted focus:border-foreground/20";

export function FundAdmin({ token, fund, suggestedShareCents }: Props) {
  const [editing, setEditing] = useState(!fund);
  const [method, setMethod] = useState<PaymentMethod>(fund?.method ?? "venmo");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveFund(token, fd);
      if (res.ok) {
        setError(null);
        setEditing(false);
      } else {
        setError(res.error);
      }
    });
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeFund(token);
      if (res.ok) setEditing(true);
      else setError(res.error);
    });
  }

  if (!editing && fund) {
    const repaid = fund.contributions.reduce((n, c) => n + c.amountCents, 0);
    const incomplete = fund.totalCents === null || fund.shareCents === null;

    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-medium">
              {fund.totalCents === null
                ? `${fund.payerName} is fronting the cost`
                : `${fund.payerName} fronted ${formatCents(fund.totalCents)}`}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
              {fund.shareCents !== null && (
                <span>{formatCents(fund.shareCents)} each ·</span>
              )}
              <PaymentIcon method={fund.method} size={14} />
              <span className="truncate">
                {METHOD_LABELS[fund.method]} · {fund.handle}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 text-[13px] text-muted underline underline-offset-2"
          >
            Edit
          </button>
        </div>

        {incomplete ? (
          <div className="mt-3 rounded-xl bg-accent/10 px-4 py-3">
            <p className="text-[14px] leading-[1.5]">
              Add the total and each person&rsquo;s share to switch this on.
              Until then nobody sees a payment button.
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 text-[14px] font-medium underline underline-offset-2"
            >
              Add the amounts
            </button>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-muted tabular-nums">
            {formatCents(repaid)} of {formatCents(fund.totalCents!)} reported
            back
          </p>
        )}

        {fund.contributions.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            {fund.contributions.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[14px]">
                  {c.name}
                  <span className="ml-2 text-muted tabular-nums">
                    {formatCents(c.amountCents)}
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {c.confirmed ? (
                    <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-success">
                      Received
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await confirmContribution(token, c.id);
                        })
                      }
                      className="min-h-11 rounded-xl px-3 text-[13px] text-foreground/80 transition hover:bg-foreground/5 disabled:opacity-60"
                    >
                      Mark received
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Remove ${c.name}'s payment`}
                    onClick={() =>
                      startTransition(async () => {
                        await removeContribution(token, c.id);
                      })
                    }
                    className="size-11 shrink-0 rounded-xl text-muted transition hover:bg-foreground/5 disabled:opacity-60"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[12.5px] leading-[1.5] text-muted/80">
          Junto doesn&rsquo;t process payments — people send money to you
          directly and report it here.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Who paid up front</span>
        <input
          name="payer_name"
          required
          maxLength={120}
          defaultValue={fund?.payerName ?? ""}
          placeholder="Dave"
          className={inputClass}
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-2">
          <span className="text-sm font-medium">
            Total spent
            <span className="ml-1 font-normal text-muted">· optional</span>
          </span>
          <input
            name="total"
            inputMode="decimal"
            defaultValue={
              fund?.totalCents != null ? (fund.totalCents / 100).toFixed(2) : ""
            }
            placeholder="120.00"
            className={inputClass}
          />
        </label>
        <label className="flex flex-1 flex-col gap-2">
          <span className="text-sm font-medium">
            Each person owes
            <span className="ml-1 font-normal text-muted">· optional</span>
          </span>
          <input
            name="share"
            inputMode="decimal"
            defaultValue={
              fund?.shareCents != null
                ? (fund.shareCents / 100).toFixed(2)
                : suggestedShareCents
                  ? (suggestedShareCents / 100).toFixed(2)
                  : ""
            }
            placeholder="15.00"
            className={inputClass}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Pay by</legend>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-[14px] transition ${
                method === m
                  ? "border-accent bg-accent/10 font-medium"
                  : "border-border text-foreground/80"
              }`}
            >
              <input
                type="radio"
                name="method"
                value={m}
                checked={method === m}
                onChange={() => setMethod(m)}
                className="sr-only"
              />
              <PaymentIcon method={m} />
              {METHOD_LABELS[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">{METHOD_LABELS[method]} handle</span>
        <input
          name="handle"
          required
          maxLength={120}
          defaultValue={fund?.handle ?? ""}
          onBlur={(e) => {
            e.target.value = normalizeHandle(method, e.target.value);
          }}
          placeholder={METHOD_PLACEHOLDERS[method]}
          className={inputClass}
        />
        <span className="text-[13px] text-muted">{METHOD_HINTS[method]}</span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          What it was for
          <span className="ml-1 font-normal text-muted">· optional</span>
        </span>
        <input
          name="note"
          maxLength={200}
          defaultValue={fund?.note ?? ""}
          placeholder="groceries"
          className={inputClass}
        />
      </label>

      {error && (
        <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-12 flex-1 rounded-2xl bg-accent text-[15px] font-semibold text-accent-fg transition active:scale-[0.99] disabled:opacity-60"
        >
          {pending ? "Saving…" : fund ? "Save" : "Add fund"}
        </button>
        {fund && (
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="h-12 rounded-2xl border border-border px-4 text-[15px] text-muted transition disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
    </form>
  );
}

export default FundAdmin;
