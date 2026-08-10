"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { pledgeContribution, type PledgeState } from "./actions";
import {
  formatCents,
  hasFixedShare,
  parseAmountToCents,
  METHOD_LABELS,
  type FundMode,
  type PaymentMethod,
} from "@/lib/payments";
import { PaymentIcon } from "@/components/PaymentIcon";

export type PayOption = {
  /** Null means the payer enters their own amount. */
  cents: number | null;
  label: string;
  href: string | null;
  qr: string | null;
};

type Props = {
  fundId: string;
  mode: FundMode;
  recipientName: string;
  method: PaymentMethod;
  handle: string;
  totalCents: number;
  shareCents: number | null;
  headcount: number | null;
  raisedCents: number;
  note: string | null;
  payOptions: PayOption[];
  desktopBrowserWorks: boolean;
  contributors: { id: string; name: string; amountCents: number; confirmed: boolean }[];
};

export function FundCard({
  fundId,
  mode,
  recipientName,
  method,
  handle,
  totalCents,
  shareCents,
  headcount,
  raisedCents,
  note,
  payOptions,
  desktopBrowserWorks,
  contributors,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [optionIndex, setOptionIndex] = useState(0);
  const [customAmount, setCustomAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, formAction] = useActionState<PledgeState | null, FormData>(
    pledgeContribution as unknown as (
      prev: PledgeState | null,
      fd: FormData,
    ) => Promise<PledgeState>,
    null,
  );
  const reduceMotion = useReducedMotion();
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const option = payOptions[optionIndex] ?? payOptions[0];
  // Only split fixes the amount; the others let the payer choose.
  const openAmount = !hasFixedShare(mode);
  const pct = Math.min(100, Math.round((raisedCents / totalCents) * 100));
  const label = METHOD_LABELS[method];
  const done = state?.ok === true;
  const funded = raisedCents >= totalCents;

  // With an open amount it's whatever the payer picked or typed. In split
  // mode it's the fixed share.
  const amountCents = openAmount
    ? (option?.cents ?? parseAmountToCents(customAmount))
    : shareCents;

  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 30 };

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the handle is visible on screen regardless.
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("fund_id", fundId);
    if (!openAmount && shareCents) fd.set("amount_cents", String(shareCents));
    startTransition(() => formAction(fd));
  }

  const heading =
    mode === "reimburse" ? (
      <>
        <span className="font-semibold">{recipientName}</span> paid{" "}
        <span className="font-semibold">{formatCents(totalCents)}</span> up
        front{note ? ` for ${note}` : ""}.
      </>
    ) : mode === "split" ? (
      <>
        Splitting <span className="font-semibold">{formatCents(totalCents)}</span>
        {note ? ` for ${note}` : ""}
        {headcount ? ` between ${headcount} people` : ""}.
      </>
    ) : (
      <>
        Raising <span className="font-semibold">{formatCents(totalCents)}</span>
        {note ? ` for ${note}` : ""}. Chip in whatever you can.
      </>
    );

  const progressLabel =
    mode === "reimburse"
      ? `${formatCents(raisedCents)} back`
      : `${formatCents(raisedCents)} in`;

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="text-[15px] leading-[1.5]">{heading}</p>

      {!openAmount && shareCents && (
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-muted">
            {mode === "split" ? "Each person" : "Your share"}
          </span>
          <span className="text-[22px] font-semibold tabular-nums">
            {formatCents(shareCents)}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]">
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${
              funded ? "bg-success" : "bg-foreground"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[13px] text-muted tabular-nums">
          {progressLabel}
        </span>
      </div>

      {funded && (
        <p className="mt-2 text-[13px] font-medium text-success">
          {mode === "reimburse"
            ? `${recipientName} has been paid back.`
            : "Fully funded — thank you."}
        </p>
      )}

      {contributors.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {contributors.map((c) => (
            <span
              key={c.id}
              className={`rounded-full px-2.5 py-0.5 text-[12px] ${
                c.confirmed
                  ? "bg-success/15 text-success"
                  : "bg-foreground/[0.06] text-muted"
              }`}
            >
              {c.name}
              {c.confirmed ? "" : " · pending"}
            </span>
          ))}
        </div>
      )}

      {done ? (
        <p className="mt-5 rounded-2xl bg-success/15 px-4 py-3 text-[14px] text-success">
          Thanks — {recipientName} will confirm it once it lands.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={`pay-${fundId}`}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-accent text-[15px] font-semibold text-accent-fg transition active:scale-[0.99]"
          >
            {open
              ? "Close"
              : openAmount
                ? "Chip in"
                : `Pay ${formatCents(shareCents ?? totalCents)}`}
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id={`pay-${fundId}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={transition}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-4 pt-4">
                  {/* Open-amount modes let the payer pick. Each preset has
                      its own prebuilt link and QR. */}
                  {payOptions.length > 1 && (
                    <div
                      role="group"
                      aria-label="How much to send"
                      className="flex flex-wrap gap-2"
                    >
                      {payOptions.map((o, i) => (
                        <button
                          key={o.label}
                          type="button"
                          onClick={() => setOptionIndex(i)}
                          aria-pressed={optionIndex === i}
                          className={`min-h-11 rounded-xl border px-4 text-[14px] transition ${
                            optionIndex === i
                              ? "border-accent bg-accent/10 font-medium"
                              : "border-border text-foreground/80"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {option?.href ? (
                    <>
                      {/* Phone: hand straight off to the app. */}
                      <a
                        href={option.href}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-foreground/[0.04] text-[15px] font-medium transition active:scale-[0.99] md:hidden"
                      >
                        <PaymentIcon method={method} size={18} />
                        Open {label}
                      </a>

                      {/* Desktop: these apps can't take a payment in a laptop
                          browser, so move the payer to their phone. */}
                      <div className="hidden flex-col items-center gap-3 md:flex">
                        {option.qr && (
                          <div
                            className="rounded-2xl bg-white p-3 [&>svg]:block [&>svg]:h-36 [&>svg]:w-36"
                            dangerouslySetInnerHTML={{ __html: option.qr }}
                          />
                        )}
                        <p className="max-w-[34ch] text-center text-[13px] leading-[1.5] text-muted">
                          Scan with your phone to open {label}
                          {option.cents
                            ? " with the amount filled in."
                            : " — you'll enter the amount yourself."}
                          {!desktopBrowserWorks &&
                            ` ${label} can't take payments in a desktop browser.`}
                        </p>
                        {desktopBrowserWorks && (
                          <a
                            href={option.href}
                            className="text-[13px] text-foreground/80 underline underline-offset-2"
                          >
                            Or pay in this browser
                          </a>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Zelle lives inside each bank's own app — no link exists. */
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">
                        Send with Zelle to
                      </span>
                      <button
                        type="button"
                        onClick={copyHandle}
                        className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border bg-foreground/[0.04] px-4 text-left transition active:scale-[0.99]"
                      >
                        <span className="truncate text-[15px]">{handle}</span>
                        <span className="shrink-0 text-[13px] text-muted">
                          {copied ? "Copied" : "Copy"}
                        </span>
                      </button>
                      <p className="text-[13px] leading-[1.5] text-muted">
                        Open your bank app or website, choose Zelle, and send
                        {amountCents ? ` ${formatCents(amountCents)}` : ""} to
                        that {handle.includes("@") ? "address" : "number"}.
                      </p>
                    </div>
                  )}

                  <form onSubmit={onSubmit} className="flex flex-col gap-3">
                    {openAmount && (
                      <label className="flex flex-col gap-2">
                        <span className="text-sm font-medium">How much you sent</span>
                        <input
                          name="amount_cents_display"
                          inputMode="decimal"
                          required
                          value={
                            option?.cents
                              ? (option.cents / 100).toFixed(2)
                              : customAmount
                          }
                          onChange={(e) => {
                            // Typing switches to the open-ended option so the
                            // link and the reported amount stay in step.
                            const other = payOptions.findIndex(
                              (o) => o.cents === null,
                            );
                            if (other >= 0) setOptionIndex(other);
                            setCustomAmount(e.target.value);
                          }}
                          placeholder="25.00"
                          className={inputClass}
                        />
                      </label>
                    )}

                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">
                        Sent it? Add your name so {recipientName} can tick you off
                      </span>
                      <input
                        name="name"
                        required
                        maxLength={120}
                        placeholder="Your name"
                        className={inputClass}
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-medium">
                        Email
                        <span className="ml-1 font-normal text-muted">
                          · optional
                        </span>
                      </span>
                      <input
                        name="email"
                        type="email"
                        maxLength={200}
                        placeholder="you@example.com"
                        className={inputClass}
                      />
                      <span className="text-[13px] text-muted">
                        Only used to reach you if this event changes or is
                        called off.
                      </span>
                    </label>

                    {/* Open-amount modes post the payer's own figure. */}
                    {openAmount && (
                      <input
                        type="hidden"
                        name="amount_cents"
                        value={amountCents ?? 0}
                      />
                    )}

                    {state && !state.ok && (
                      <p
                        role="alert"
                        className="text-[13px] text-red-600 dark:text-red-400"
                      >
                        {state.error}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={pending}
                      className="h-12 rounded-2xl border border-border bg-card text-[15px] font-medium transition active:scale-[0.99] disabled:opacity-60"
                    >
                      {pending ? "Saving…" : "I sent it"}
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-transparent bg-foreground/[0.04] px-4 py-3 text-[16px] outline-none transition placeholder:text-muted focus:border-foreground/20";

export default FundCard;
