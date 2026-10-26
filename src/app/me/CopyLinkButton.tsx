"use client";

import { useState } from "react";

/** Copies an event's share link, for pasting into a group chat. */
export function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (rare): fall back to opening the link to copy by hand.
      window.open(url, "_blank", "noopener");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy link to ${label}`}
      className={`relative z-10 h-9 shrink-0 rounded-xl px-3 text-[13px] font-medium transition active:scale-95 ${
        copied
          ? "bg-success/15 text-success"
          : "bg-foreground/[0.06] text-foreground/80 hover:bg-foreground/10"
      }`}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
