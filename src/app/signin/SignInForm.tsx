"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  sendSignInCode,
  verifySignInCode,
  type SendState,
  type VerifyState,
} from "./actions";

const inputClass =
  "w-full rounded-xl bg-foreground/[0.05] px-4 py-3 text-[16px] outline-none transition placeholder:text-muted focus:bg-foreground/[0.02] focus:ring-2 focus:ring-foreground/15";

const buttonClass =
  "h-14 rounded-2xl bg-accent text-[17px] font-semibold text-accent-fg transition active:scale-[0.98] disabled:opacity-60";

/** Two steps on one page: ask for an email, then for the code we sent to it. */
export function SignInForm({ next }: { next: string }) {
  const [sent, send, sending] = useActionState<SendState, FormData>(
    sendSignInCode,
    null,
  );
  const [verified, verify, verifying] = useActionState<VerifyState, FormData>(
    verifySignInCode,
    null,
  );
  // "Use a different email" goes back a step; sending again comes forward.
  const [editingEmail, setEditingEmail] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const onCodeStep = Boolean(sent?.ok) && !editingEmail;

  useEffect(() => {
    if (onCodeStep) codeRef.current?.focus();
  }, [onCodeStep]);

  if (!onCodeStep || !sent?.ok) {
    return (
      <form
        action={send}
        onSubmit={() => setEditingEmail(false)}
        className="mt-8 flex flex-col gap-4"
      >
        <input type="hidden" name="next" value={next} />
        <input
          name="email"
          type="email"
          required
          defaultValue={sent?.ok ? sent.email : ""}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          aria-label="Email"
          className={inputClass}
        />
        <button type="submit" disabled={sending} className={buttonClass}>
          {sending ? "Sending…" : "Email me a code"}
        </button>
        {sent && !sent.ok && <ErrorNote>{sent.error}</ErrorNote>}
      </form>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-4">
      <p className="rounded-2xl bg-success/15 px-4 py-3 text-sm text-success">
        We sent a code to <strong className="font-semibold">{sent.email}</strong>.
        Type it below, or tap the link in the email.
      </p>

      <form action={verify} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={sent.email} />
        <input type="hidden" name="next" value={next} />
        <input
          ref={codeRef}
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,12}"
          maxLength={12}
          placeholder="Code"
          aria-label="Sign-in code"
          className={`${inputClass} text-center text-[22px] font-semibold tracking-[0.3em] tabular-nums placeholder:tracking-normal placeholder:font-normal placeholder:text-[16px]`}
        />
        <button type="submit" disabled={verifying} className={buttonClass}>
          {verifying ? "Signing in…" : "Sign in"}
        </button>
        {verified && !verified.ok && <ErrorNote>{verified.error}</ErrorNote>}
      </form>

      <div className="flex items-center justify-between gap-3 text-[14px]">
        <button
          type="button"
          onClick={() => setEditingEmail(true)}
          className="text-muted underline underline-offset-2 transition hover:text-foreground"
        >
          Use a different email
        </button>
        <form action={send}>
          <input type="hidden" name="email" value={sent.email} />
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            disabled={sending}
            className="text-muted underline underline-offset-2 transition hover:text-foreground disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send a new code"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
    >
      {children}
    </p>
  );
}
