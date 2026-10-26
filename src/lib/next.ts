/**
 * Where to send someone after signing in. Only same-site paths are allowed —
 * an open redirect would let a link that looks like Junto's sign-in bounce
 * people to any site.
 */
export function safeNext(raw: string | null | undefined, fallback = "/me"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}
