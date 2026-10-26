/**
 * Contribution sheets: a list of names, a few ways to contribute, and a tick
 * box where they meet. Rules shared by the create form, the server actions and
 * the manage page live here so they can't drift apart.
 */

/** What a church meal team usually needs. Renameable before and after. */
export const DEFAULT_COLUMNS = ["Food", "Serve", "Money"] as const;

export const MAX_COLUMNS = 8;
export const MAX_ROWS = 200;
export const LABEL_MAX = 40;
export const NAME_MAX = 80;
export const NOTE_MAX = 200;

/** Collapse runs of whitespace and trim, so "  Sarah   Jones " === "Sarah Jones". */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

/** Case-insensitive identity, for spotting the same person entered twice. */
export function nameKey(name: string): string {
  return cleanName(name).toLocaleLowerCase();
}

/**
 * Turns a pasted block — one name per line, or a comma-separated list from a
 * group chat — into clean, unique names in the order given.
 */
export function parseNames(text: string, existing: string[] = []): string[] {
  const seen = new Set(existing.map(nameKey));
  const out: string[] = [];

  for (const part of text.split(/[\n,;]+/)) {
    const name = cleanName(part);
    if (!name) continue;
    const key = nameKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }

  return out;
}

export type ColumnsResult =
  | { ok: true; labels: string[] }
  | { ok: false; error: string };

/** Validates the column labels an organizer typed. */
export function parseColumns(raw: unknown): ColumnsResult {
  if (!Array.isArray(raw)) return { ok: false, error: "Add at least one column" };

  const labels: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const label = cleanLabel(String(item ?? ""));
    if (!label) continue;
    const key = label.toLocaleLowerCase();
    if (seen.has(key)) {
      return { ok: false, error: `"${label}" is listed twice` };
    }
    seen.add(key);
    labels.push(label);
  }

  if (labels.length === 0) return { ok: false, error: "Add at least one column" };
  if (labels.length > MAX_COLUMNS) {
    return { ok: false, error: `Up to ${MAX_COLUMNS} columns` };
  }
  return { ok: true, labels };
}

export function cleanLabel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, LABEL_MAX);
}

export function cleanNote(raw: string): string | null {
  return raw.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) || null;
}

/**
 * Live updates. When a sheet changes, the server broadcasts a bare "changed"
 * on this channel and every open copy of the page reloads its data. The
 * message carries nothing — the page fetches what it's allowed to see.
 */
export function sheetChannel(eventId: string): string {
  return `sheet:${eventId}`;
}

export const SHEET_CHANGED = "changed";
