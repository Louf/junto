import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  FUND_MODES,
  GOAL_PRESETS,
  PAYMENT_METHODS,
  formatCents,
  hasFixedShare,
  isFundMode,
  isPaymentMethod,
  isValidHandle,
  normalizeHandle,
  parseAmountToCents,
  payProfileUrl,
  payUrl,
  payableInDesktopBrowser,
  type PaymentMethod,
} from "./payments.ts";

/** Normalize then validate, the way every caller does. */
function accept(method: PaymentMethod, raw: string) {
  const handle = normalizeHandle(method, raw);
  return { handle, valid: isValidHandle(method, handle) };
}

describe("normalizeHandle", () => {
  test("strips a leading @ or $", () => {
    assert.equal(normalizeHandle("venmo", "@dave-smith"), "dave-smith");
    assert.equal(normalizeHandle("cashapp", "$davesmith"), "davesmith");
  });

  test("trims surrounding whitespace", () => {
    assert.equal(normalizeHandle("venmo", "  dave-smith  "), "dave-smith");
  });

  test("strips pasted profile URLs", () => {
    assert.equal(
      normalizeHandle("venmo", "https://venmo.com/dave-smith"),
      "dave-smith",
    );
    assert.equal(normalizeHandle("venmo", "venmo.com/u/dave-smith"), "dave-smith");
    assert.equal(
      normalizeHandle("cashapp", "https://cash.app/$davesmith"),
      "davesmith",
    );
    assert.equal(
      normalizeHandle("cashapp", "https://cash.me/$davesmith"),
      "davesmith",
    );
    assert.equal(
      normalizeHandle("paypal", "https://www.paypal.com/paypalme/davesmith"),
      "davesmith",
    );
  });

  test("drops trailing paths and query strings", () => {
    // Cash App links carry an amount; copied URLs often carry a query.
    assert.equal(normalizeHandle("cashapp", "cash.app/$davesmith/25"), "davesmith");
    assert.equal(
      normalizeHandle("venmo", "https://www.venmo.com/u/dave-smith?txn=pay"),
      "dave-smith",
    );
    assert.equal(normalizeHandle("paypal", "https://paypal.me/davesmith/15"), "davesmith");
  });

  test("reduces Zelle phone numbers to digits and drops a US country code", () => {
    assert.equal(normalizeHandle("zelle", "(555) 123-4567"), "5551234567");
    assert.equal(normalizeHandle("zelle", "+1 555-123-4567"), "5551234567");
    assert.equal(normalizeHandle("zelle", "555.123.4567"), "5551234567");
  });

  test("leaves Zelle emails alone", () => {
    assert.equal(normalizeHandle("zelle", "dave@example.com"), "dave@example.com");
  });
});

describe("handle validation fails closed", () => {
  test("an unknown domain survives normalization but fails validation", () => {
    // This is the anti-phishing guarantee: stripping only ever removes known
    // payment domains, so anything else keeps its slashes and colons and is
    // rejected by the per-method pattern.
    const { handle, valid } = accept("venmo", "https://evil.com/dave-smith");
    assert.equal(valid, false);
    assert.ok(handle.includes(":") || handle.includes("/") || handle === "https:");
  });

  test("rejects a too-short Zelle number", () => {
    assert.equal(accept("zelle", "12345").valid, false);
  });

  test("rejects handles with illegal characters", () => {
    assert.equal(accept("venmo", "dave smith").valid, false);
    assert.equal(accept("paypal", "dave-smith").valid, false); // PayPal is alnum only
  });

  test("accepts the ordinary cases", () => {
    assert.equal(accept("venmo", "dave-smith").valid, true);
    assert.equal(accept("cashapp", "davesmith").valid, true);
    assert.equal(accept("paypal", "davesmith").valid, true);
    assert.equal(accept("zelle", "dave@example.com").valid, true);
    assert.equal(accept("zelle", "5551234567").valid, true);
  });
});

describe("payUrl", () => {
  test("builds an amount-prefilled link per method", () => {
    assert.equal(
      payUrl("venmo", "dave-smith", 1500, "Potluck"),
      "https://venmo.com/dave-smith?txn=pay&amount=15.00&note=Potluck",
    );
    assert.equal(
      payUrl("cashapp", "davesmith", 1500, "Potluck"),
      "https://cash.app/$davesmith/15.00",
    );
    assert.equal(
      payUrl("paypal", "davesmith", 1500, "Potluck"),
      "https://paypal.me/davesmith/15.00",
    );
  });

  test("returns null for Zelle, which has no payment URL", () => {
    assert.equal(payUrl("zelle", "dave@example.com", 1500, "Potluck"), null);
    assert.equal(payProfileUrl("zelle", "dave@example.com"), null);
  });

  test("URL-encodes the note", () => {
    const url = payUrl("venmo", "dave-smith", 1000, "Sam & Kim's potluck");
    assert.ok(url?.includes("note=Sam%20%26%20Kim's%20potluck"));
  });

  test("every link points at a hardcoded payment domain", () => {
    const allowed = ["venmo.com", "cash.app", "paypal.me"];
    for (const method of PAYMENT_METHODS) {
      const url = payUrl(method, "davesmith", 1000, "x");
      if (url === null) continue;
      assert.ok(
        allowed.some((d) => new URL(url).host === d),
        `${method} produced an unexpected host: ${url}`,
      );
    }
  });

  test("formats cents without floating point drift", () => {
    assert.ok(payUrl("cashapp", "d", 1, "x")?.endsWith("/0.01"));
    assert.ok(payUrl("cashapp", "d", 999999, "x")?.endsWith("/9999.99"));
    assert.ok(payUrl("cashapp", "d", 70, "x")?.endsWith("/0.70"));
  });
});

describe("payProfileUrl", () => {
  test("omits the amount so the payer can enter their own", () => {
    assert.equal(payProfileUrl("venmo", "dave-smith"), "https://venmo.com/dave-smith");
    assert.equal(payProfileUrl("cashapp", "davesmith"), "https://cash.app/$davesmith");
    assert.equal(payProfileUrl("paypal", "davesmith"), "https://paypal.me/davesmith");
  });
});

describe("payableInDesktopBrowser", () => {
  test("only PayPal can complete a payment on a laptop", () => {
    // Venmo removed web payments in 2018; Cash App is app-first.
    assert.equal(payableInDesktopBrowser("paypal"), true);
    assert.equal(payableInDesktopBrowser("venmo"), false);
    assert.equal(payableInDesktopBrowser("cashapp"), false);
  });
});

describe("formatCents", () => {
  test("drops the decimals on whole amounts", () => {
    assert.equal(formatCents(1500), "$15");
    assert.equal(formatCents(12000), "$120");
  });

  test("keeps them otherwise", () => {
    assert.equal(formatCents(1550), "$15.50");
    assert.equal(formatCents(1), "$0.01");
  });
});

describe("parseAmountToCents", () => {
  test("parses plain and decorated amounts", () => {
    assert.equal(parseAmountToCents("15"), 1500);
    assert.equal(parseAmountToCents("15.00"), 1500);
    assert.equal(parseAmountToCents("15.5"), 1550);
    assert.equal(parseAmountToCents("$15.50"), 1550);
    assert.equal(parseAmountToCents(" 1,200.00 "), 120000);
  });

  test("rejects anything that isn't a positive amount", () => {
    assert.equal(parseAmountToCents(""), null);
    assert.equal(parseAmountToCents("abc"), null);
    assert.equal(parseAmountToCents("0"), null);
    assert.equal(parseAmountToCents("-5"), null);
    assert.equal(parseAmountToCents("15.999"), null);
    assert.equal(parseAmountToCents("1.2.3"), null);
  });

  test("round-trips through formatCents", () => {
    for (const raw of ["1", "15.50", "0.01", "1200"]) {
      const cents = parseAmountToCents(raw);
      assert.ok(cents !== null);
      assert.equal(parseAmountToCents(formatCents(cents).replace("$", "")), cents);
    }
  });
});

describe("fund modes", () => {
  test("only split fixes a per-person amount", () => {
    assert.equal(hasFixedShare("split"), true);
    assert.equal(hasFixedShare("reimburse"), false);
    assert.equal(hasFixedShare("goal"), false);
  });

  test("guards accept known values and reject others", () => {
    for (const m of FUND_MODES) assert.equal(isFundMode(m), true);
    for (const m of PAYMENT_METHODS) assert.equal(isPaymentMethod(m), true);
    assert.equal(isFundMode("donate"), false);
    assert.equal(isPaymentMethod("bitcoin"), false);
  });

  test("goal presets are whole dollars in ascending order", () => {
    const presets = [...GOAL_PRESETS];
    assert.deepEqual(presets, [...presets].sort((a, b) => a - b));
    for (const p of presets) assert.equal(p % 100, 0);
  });
});
