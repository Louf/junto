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
  hasFixedShare,
  FUND_MODES,
  METHOD_HINTS,
  METHOD_LABELS,
  METHOD_PLACEHOLDERS,
  MODE_HINTS,
  MODE_LABELS,
  PAYMENT_METHODS,
  normalizeHandle,
  type FundMode,
  type PaymentMethod,
} from "@/lib/payments";
import { PaymentIcon } from "@/components/PaymentIcon";

type Contribution = {
  id: string;
  name: string;
  email: string | null;
  amountCents: number;
  confirmed: boolean;
};

type Props = {
  token: string;
  suggestedHeadcount: number | null;
  fund: {
    mode: FundMode;
    recipientName: string;
    totalCents: number | null;
    shareCents: number | null;
    headcount: number | null;
    method: PaymentMethod;
    handle: string;
    note: string | null;
    contributions: Contribution[];
  } | null;
};

const inputClass =
  "w-full rounded-xl border border-transparent bg-foreground/[0.04] px-4 py-3 text-[16px] outline-none transition placeholder:text-muted focus:border-foreground/20";

/** Which figures each mode actually needs from the organizer. */
const RECIPIENT_LABEL: Record<FundMode, string> = {
  reimburse: "Who paid up front",
  split: "Who's collecting",
  goal: "Who's collecting",
};

export function FundAdmin({ token, fund, suggestedHeadcount }: Props) {
  const [editing, setEditing] = useState(!fund);
  const [mode, setMode] = useState<FundMode>(fund?.mode ?? "reimburse");
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
    const collected = fund.contributions.reduce((n, c) => n + c.amountCents, 0);
    // Only split needs a per-person share; the others just need a total.
    const incomplete =
      fund.totalCents === null ||
      (hasFixedShare(fund.mode) && fund.shareCents === null);

    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-medium">
              {fund.mode === "reimburse" &&
                (fund.totalCents === null
                  ? `${fund.recipientName} is fronting the cost`
                  : `${fund.recipientName} fronted ${formatCents(fund.totalCents)}`)}
              {fund.mode === "split" &&
                (fund.totalCents === null
                  ? "Splitting the cost"
                  : `Splitting ${formatCents(fund.totalCents)}`)}
              {fund.mode === "goal" &&
                (fund.totalCents === null
                  ? "Raising a total"
                  : `Raising ${formatCents(fund.totalCents)}`)}
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
              {hasFixedShare(fund.mode)
                ? "Add each person's share and how many people to switch this on."
                : "Add a total to switch this on."}{" "}
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
            {formatCents(collected)} of {formatCents(fund.totalCents!)} reported
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
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">How you&rsquo;re collecting</legend>
        <div className="flex flex-col gap-2">
          {FUND_MODES.map((m) => (
            <label
              key={m}
              className={`cursor-pointer rounded-xl border px-4 py-3 transition ${
                mode === m
                  ? "border-accent bg-accent/10"
                  : "border-border text-foreground/80"
              }`}
            >
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="sr-only"
              />
              <span
                className={`block text-[14px] ${mode === m ? "font-medium" : ""}`}
              >
                {MODE_LABELS[m]}
              </span>
              <span className="mt-0.5 block text-[13px] text-muted">
                {MODE_HINTS[m]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">{RECIPIENT_LABEL[mode]}</span>
        <input
          name="recipient_name"
          required
          maxLength={120}
          defaultValue={fund?.recipientName ?? ""}
          placeholder="Dave"
          className={inputClass}
        />
      </label>

      {/* Split derives its total from share x headcount, so it asks for those
          two instead. Goal has no per-person share at all. */}
      {mode === "split" ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-2">
            <span className="text-sm font-medium">Each person owes</span>
            <input
              name="share"
              inputMode="decimal"
              defaultValue={
                fund?.shareCents != null
                  ? (fund.shareCents / 100).toFixed(2)
                  : ""
              }
              placeholder="15.00"
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-2">
            <span className="text-sm font-medium">How many people</span>
            <input
              name="headcount"
              inputMode="numeric"
              defaultValue={
                fund?.headcount != null
                  ? String(fund.headcount)
                  : suggestedHeadcount
                    ? String(suggestedHeadcount)
                    : ""
              }
              placeholder="8"
              className={inputClass}
            />
          </label>
          </div>
          <span className="text-[13px] text-muted">
            The total is worked out from these two. Leave them blank for now if
            you don&rsquo;t know yet — nobody sees a payment button until both
            are filled in.
          </span>
        </div>
      ) : (
        /* Reimburse and goal both just need a total. Recouping a cost doesn't
           care who contributes what, only whether the total is met. */
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            {mode === "reimburse" ? "Total spent" : "Target"}
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
          <span className="text-[13px] text-muted">
            {mode === "reimburse"
              ? "People chip in what they can until this is recouped."
              : "People chip in whatever they can toward this."}{" "}
            Leave it blank for now if you don&rsquo;t know yet — nobody sees a
            payment button until it&rsquo;s filled in.
          </span>
        </label>
      )}

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
          What it&rsquo;s for
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
