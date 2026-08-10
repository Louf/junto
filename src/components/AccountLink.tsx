"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const CLASS =
  "flex h-[46px] items-center justify-center rounded-2xl border border-border bg-card text-[14.5px] font-medium text-foreground/80 transition hover:bg-card/80 active:scale-[0.99]";

/**
 * Resolves the signed-in state in the browser so the homepage can stay
 * static. Renders the signed-out label first, then upgrades if a session
 * turns up — the destination is correct either way.
 */
export function AccountLink() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.user));
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Link href={signedIn ? "/me" : "/recover"} className={CLASS}>
      {signedIn ? "Your events" : "Find my events"}
    </Link>
  );
}

export default AccountLink;
