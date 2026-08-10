/**
 * Payment handoff. Junto never processes money — it builds links into the
 * payer's own app and records what people say they sent.
 *
 * Handles are stored as bare handles, never URLs. Every link is constructed
 * here from a fixed domain, so an organizer cannot point a pay button at a
 * domain they control.
 */

export const PAYMENT_METHODS = ["venmo", "cashapp", "paypal", "zelle"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const FUND_MODES = ["reimburse", "split", "goal"] as const;
export type FundMode = (typeof FUND_MODES)[number];

export const MODE_LABELS: Record<FundMode, string> = {
  reimburse: "Pay someone back",
  split: "Split the cost",
  goal: "Raise a total",
};

export const MODE_HINTS: Record<FundMode, string> = {
  reimburse:
    "Someone already spent the money. People chip in until it's recouped.",
  split: "A fixed amount per person, divided evenly.",
  goal: "A target to reach. People chip in whatever they can.",
};

export function isFundMode(value: string): value is FundMode {
  return (FUND_MODES as readonly string[]).includes(value);
}

/**
 * Whether everyone owes the same fixed amount.
 *
 * Only split does. Reimburse and goal both just need a total — recouping a
 * cost doesn't care who contributes what, it cares whether the total is met.
 */
export function hasFixedShare(mode: FundMode): boolean {
  return mode === "split";
}

/** Suggested chip-in amounts for goal mode, in cents. */
export const GOAL_PRESETS = [1000, 2500, 5000] as const;

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  paypal: "PayPal",
  zelle: "Zelle",
};

/** What the organizer types in, shown as placeholder text. */
export const METHOD_PLACEHOLDERS: Record<PaymentMethod, string> = {
  venmo: "dave-smith",
  cashapp: "davesmith",
  paypal: "davesmith",
  zelle: "dave@example.com or 5551234567",
};

export const METHOD_HINTS: Record<PaymentMethod, string> = {
  venmo: "Your Venmo username, without the @.",
  cashapp: "Your $Cashtag, without the $.",
  paypal: "Your PayPal.Me name.",
  zelle: "The email or US mobile number your bank has on file for Zelle.",
};

const HANDLE_PATTERNS: Record<PaymentMethod, RegExp> = {
  venmo: /^[A-Za-z0-9_-]{3,30}$/,
  cashapp: /^[A-Za-z0-9_]{1,20}$/,
  paypal: /^[A-Za-z0-9]{1,20}$/,
  // Email, or a 10–11 digit US number once punctuation is stripped.
  zelle: /^(?:[^\s@]+@[^\s@]+\.[^\s@]+|\d{10,11})$/,
};

/**
 * Prefixes people paste instead of typing a bare handle, usually by copying
 * their own profile link. Anything not matched here falls through to the
 * validation regex and is rejected, so an unknown domain can never survive
 * normalization.
 */
const URL_PREFIXES: Record<PaymentMethod, RegExp[]> = {
  venmo: [/^(?:https?:\/\/)?(?:www\.)?venmo\.com\/(?:u\/)?/i],
  cashapp: [
    /^(?:https?:\/\/)?(?:www\.)?cash\.app\/\$?/i,
    /^(?:https?:\/\/)?(?:www\.)?cash\.me\/\$?/i,
  ],
  paypal: [
    /^(?:https?:\/\/)?(?:www\.)?paypal\.me\//i,
    /^(?:https?:\/\/)?(?:www\.)?paypal\.com\/paypalme\//i,
  ],
  zelle: [],
};

/**
 * Reduces whatever someone typed to a bare handle: strips a leading @ or $,
 * a pasted profile URL, and any trailing path, query, or fragment.
 */
export function normalizeHandle(method: PaymentMethod, raw: string): string {
  let value = raw.trim();

  if (method === "zelle") {
    // Keep emails as typed; reduce phone numbers to digits so formatting,
    // spaces, and a +1 country code all land on the same value.
    if (value.includes("@")) return value;
    const digits = value.replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits;
  }

  for (const prefix of URL_PREFIXES[method]) {
    if (prefix.test(value)) {
      value = value.replace(prefix, "");
      break;
    }
  }

  // Drop anything after the handle itself — cash.app links carry an amount
  // (cash.app/$dave/25), and copied URLs often trail a query string.
  value = value.split(/[/?#]/)[0] ?? "";

  return value.replace(/^[@$]+/, "");
}

export function isValidHandle(method: PaymentMethod, handle: string): boolean {
  return HANDLE_PATTERNS[method].test(handle);
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

/**
 * Deep link into the payer's app with the amount prefilled.
 *
 * Always https, never a custom scheme — a custom scheme fails silently when
 * the app isn't installed, while a universal link degrades to the web page.
 *
 * Returns null for Zelle, which has no per-person payment URL: it lives
 * inside each bank's own app and is addressed by phone or email.
 */
export function payUrl(
  method: PaymentMethod,
  handle: string,
  cents: number,
  note: string,
): string | null {
  const amount = (cents / 100).toFixed(2);

  switch (method) {
    case "venmo":
      return `https://venmo.com/${encodeURIComponent(handle)}?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`;
    case "cashapp":
      // Cash App reads the amount from the path. It has no note parameter.
      return `https://cash.app/$${encodeURIComponent(handle)}/${amount}`;
    case "paypal":
      return `https://paypal.me/${encodeURIComponent(handle)}/${amount}`;
    case "zelle":
      return null;
  }
}

/**
 * Link to the recipient's profile with no amount attached, for when the payer
 * is entering their own figure. All three apps accept a bare handle URL.
 */
export function payProfileUrl(
  method: PaymentMethod,
  handle: string,
): string | null {
  switch (method) {
    case "venmo":
      return `https://venmo.com/${encodeURIComponent(handle)}`;
    case "cashapp":
      return `https://cash.app/$${encodeURIComponent(handle)}`;
    case "paypal":
      return `https://paypal.me/${encodeURIComponent(handle)}`;
    case "zelle":
      return null;
  }
}

/**
 * Whether a desktop browser can actually complete the payment.
 *
 * Venmo removed web payments in 2018 and Cash App is app-first, so on desktop
 * those links dead-end. PayPal is web-native. Zelle has no link at all, but
 * the payer's bank website works, so the handle is what they need.
 */
export function payableInDesktopBrowser(method: PaymentMethod): boolean {
  return method === "paypal";
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "12.50" or "12" -> 1250 or 1200. Returns null when unparseable. */
export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}
