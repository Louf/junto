import { headers } from "next/headers";
import { supabaseService } from "./supabase/service";

/**
 * Throttle for unauthenticated public actions, counted in Postgres so every
 * serverless instance shares one bucket.
 *
 * Fixed window rather than sliding: simpler, one round trip, and the failure
 * mode (a burst straddling a window boundary) is acceptable for what this
 * protects against. See supabase/migrations/*_add_rate_limits.sql.
 */
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export async function hit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const supa = supabaseService();

  const { data, error } = await supa.rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  // Fail open. This is a speed bump, not an authorization check — if the
  // limiter itself is broken, that shouldn't stop people signing up.
  if (error) {
    console.error("[rateLimit] check failed, allowing request", error);
    return { ok: true };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.allowed) return { ok: true };

  return { ok: false, retryAfterSeconds: row.retry_after_seconds ?? 60 };
}

/**
 * Caller identity, best guess. Proxies set x-forwarded-for; the leftmost entry
 * is the client. Spoofable, which is another reason this is a speed bump
 * rather than a security control.
 */
export async function callerKey(scope: string): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

/** Human-readable wait, for the message shown to whoever got throttled. */
export function retryMessage(seconds: number): string {
  if (seconds <= 60) return "Wait a moment and try again.";
  const minutes = Math.ceil(seconds / 60);
  return `Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
