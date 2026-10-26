"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SHEET_CHANGED, sheetChannel } from "@/lib/sheet";

/** Long enough to fold someone ticking a whole row into one reload. */
const SETTLE_MS = 600;

/**
 * Keeps an open sheet current. Renders nothing; listens for the server's
 * "changed" signal on this event's channel and reloads the page data, so a
 * tick on one phone shows up on everyone else's within a second.
 */
export function SheetLive({ eventId }: { eventId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supa = createSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    function reload() {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, SETTLE_MS);
    }

    const channel = supa
      .channel(sheetChannel(eventId))
      .on("broadcast", { event: SHEET_CHANGED }, reload)
      .subscribe();

    // A phone that slept dropped its connection and any signals sent
    // meanwhile, so catch up whenever the page comes back into view.
    function onVisible() {
      if (document.visibilityState === "visible") reload();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supa.removeChannel(channel);
    };
  }, [eventId, router]);

  return null;
}
