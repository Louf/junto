"use client";

import { useState } from "react";

export function ShareCard({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url: shareUrl, title: "Sign up" });
        return;
      } catch {
        // user cancelled or unsupported, fall through
      }
    }
    copy();
  }

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
        Share link
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded-xl bg-foreground/[0.05] px-3 py-2 text-[14px]">
          {shareUrl}
        </code>
        <button
          onClick={copy}
          className="h-10 px-3 rounded-xl text-[14px] font-medium bg-foreground/[0.06] hover:bg-foreground/[0.1] active:scale-95 transition"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <button
        onClick={share}
        className="mt-3 h-12 w-full rounded-xl bg-accent text-accent-fg text-[15px] font-semibold active:scale-[0.98] transition"
      >
        Share
      </button>
    </div>
  );
}
