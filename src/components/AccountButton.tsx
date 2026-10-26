"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Who = { state: "unknown" } | { state: "out" } | { state: "in"; email: string };

/**
 * Top-right account entry: "Sign in" when signed out, your initial (linking to
 * your events) when signed in.
 *
 * Read in the browser so pages can stay static. Until it knows, it holds an
 * empty slot rather than guessing, so nothing flickers between the two.
 */
export function AccountButton({
  hideWhenSignedOut = false,
}: {
  /** For pages participants land on, where "Sign in" would only confuse. */
  hideWhenSignedOut?: boolean;
}) {
  const [who, setWho] = useState<Who>({ state: "unknown" });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    // The local session is enough to choose a button; the server still checks
    // properly before showing anything private.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const email = data.session?.user.email;
      setWho(email ? { state: "in", email } : { state: "out" });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user.email;
      setWho(email ? { state: "in", email } : { state: "out" });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (who.state === "unknown") {
    return hideWhenSignedOut ? null : <span aria-hidden className="h-9 w-9" />;
  }

  if (who.state === "out") {
    if (hideWhenSignedOut) return null;
    return (
      <Link
        href="/signin"
        className="flex h-9 items-center rounded-full border border-border bg-card px-3.5 text-[14px] font-medium text-foreground/80 transition hover:text-foreground active:scale-95"
      >
        Sign in
      </Link>
    );
  }

  return (
    <Link
      href="/me"
      aria-label={`Your events (${who.email})`}
      title={who.email}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[15px] font-semibold uppercase text-accent-fg transition active:scale-95"
    >
      {who.email.charAt(0)}
    </Link>
  );
}
