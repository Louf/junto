import { after } from "next/server";
import { supabaseService } from "./supabase/service";
import { SHEET_CHANGED, sheetChannel } from "./sheet";

/**
 * Tells everyone with this event's page open to reload it.
 *
 * Runs after the response so a tick isn't slowed down waiting on it, and a
 * failure is only logged: a missed signal means someone sees the change on
 * their next refresh instead of straight away.
 */
export function announceSheetChange(eventId: string) {
  after(async () => {
    const supa = supabaseService();
    // Sent over REST, so there's no socket to open or keep alive here.
    const channel = supa.channel(sheetChannel(eventId));
    try {
      const res = await channel.httpSend(SHEET_CHANGED, {});
      if (!res.success) console.error("[sheet] broadcast failed", res.error);
    } catch (e) {
      console.error("[sheet] broadcast failed", e);
    } finally {
      await supa.removeChannel(channel);
    }
  });
}
