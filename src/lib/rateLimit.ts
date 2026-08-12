import { headers } from "next/headers";

/**
 * Best-effort throttle for unauthenticated public actions.
 *
 * IMPORTANT: this is in-memory and therefore per-instance. On serverless it
 * resets on cold start and doesn't coordinate across concurrent instances, so
 * it stops naive floods from a single client and nothing more. Before real
 * traffic this should move to a shared store (Upstash, or a Postgres table
 * with a periodic sweep).
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Stop the map growing without bound on a long-lived instance. */
function sweep(now: number) {
  if (buckets.size < 5_000) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number };

export function hit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true };
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
