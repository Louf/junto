import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildIcs,
  escapeText,
  foldLine,
  googleCalendarUrl,
  toIcsUtc,
} from "./ics.ts";

const START = new Date("2026-11-28T00:00:00.000Z");
const END = new Date("2026-11-28T02:00:00.000Z");
const STAMP = new Date("2026-08-11T12:00:00.000Z");

function base(overrides: Partial<Parameters<typeof buildIcs>[0]> = {}) {
  return buildIcs({
    uid: "abc123@junto",
    start: START,
    end: END,
    summary: "Thanksgiving potluck",
    stamp: STAMP,
    ...overrides,
  });
}

/** Undo folding so assertions can look at logical lines. */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
}

describe("escapeText", () => {
  test("escapes the four special sequences", () => {
    assert.equal(escapeText("Dinner, drinks; dessert"), "Dinner\\, drinks\\; dessert");
    assert.equal(escapeText("back\\slash"), "back\\\\slash");
    assert.equal(escapeText("line one\nline two"), "line one\\nline two");
    assert.equal(escapeText("crlf\r\nhere"), "crlf\\nhere");
  });

  test("escapes backslashes before anything else, not after", () => {
    // Getting the order wrong double-escapes the inserted backslashes.
    assert.equal(escapeText("a\\,b"), "a\\\\\\,b");
  });

  test("leaves ordinary text alone", () => {
    assert.equal(escapeText("Church hall"), "Church hall");
  });
});

describe("foldLine", () => {
  test("leaves short lines alone", () => {
    assert.equal(foldLine("SUMMARY:Potluck"), "SUMMARY:Potluck");
  });

  test("folds with CRLF and a leading space", () => {
    const folded = foldLine("SUMMARY:" + "a".repeat(200));
    assert.ok(folded.includes("\r\n "));
    for (const line of folded.split("\r\n")) {
      assert.ok(
        new TextEncoder().encode(line).length <= 75,
        `line exceeded 75 octets: ${line.length}`,
      );
    }
  });

  test("unfolding restores the original", () => {
    const original = "DESCRIPTION:" + "long text ".repeat(30);
    assert.equal(foldLine(original).replace(/\r\n /g, ""), original);
  });

  test("counts octets, not characters, and never splits one", () => {
    // Emoji are four bytes each; folding by character length would produce
    // lines a strict parser rejects, or split a character in half.
    const line = "SUMMARY:" + "🎉".repeat(40);
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) {
      assert.ok(new TextEncoder().encode(part).length <= 75);
    }
    assert.equal(folded.replace(/\r\n /g, ""), line);
    assert.ok(!folded.includes("�"), "a multi-byte character was split");
  });
});

describe("toIcsUtc", () => {
  test("formats as a UTC timestamp with no punctuation", () => {
    assert.equal(toIcsUtc(START), "20261128T000000Z");
  });

  test("is unaffected by the process timezone", () => {
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "America/Chicago", "Asia/Tokyo"]) {
        process.env.TZ = tz;
        assert.equal(toIcsUtc(START), "20261128T000000Z");
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe("buildIcs", () => {
  test("produces a well-formed calendar", () => {
    const lines = unfold(base());
    assert.equal(lines[0], "BEGIN:VCALENDAR");
    assert.equal(lines.at(-1), "END:VCALENDAR");
    assert.ok(lines.includes("BEGIN:VEVENT"));
    assert.ok(lines.includes("END:VEVENT"));
    assert.ok(lines.includes("VERSION:2.0"));
    assert.ok(lines.includes("UID:abc123@junto"));
    assert.ok(lines.includes("DTSTART:20261128T000000Z"));
    assert.ok(lines.includes("DTEND:20261128T020000Z"));
    assert.ok(lines.includes("SUMMARY:Thanksgiving potluck"));
  });

  test("uses CRLF throughout and ends with one", () => {
    const ics = base();
    assert.ok(ics.endsWith("\r\n"));
    assert.ok(!/[^\r]\n/.test(ics), "found a bare LF");
  });

  test("omits optional fields rather than emitting empty ones", () => {
    const lines = unfold(base());
    assert.ok(!lines.some((l) => l.startsWith("LOCATION")));
    assert.ok(!lines.some((l) => l.startsWith("DESCRIPTION")));
    assert.ok(!lines.some((l) => l.startsWith("URL")));
  });

  test("includes optional fields when present", () => {
    const lines = unfold(
      base({
        location: "Church hall, 12 Oak Street",
        description: "Bring a dish",
        url: "https://junto.app/e/abc123",
        organizerEmail: "dave@example.com",
      }),
    );
    // The comma in the address must be escaped or parsers split the property.
    assert.ok(lines.includes("LOCATION:Church hall\\, 12 Oak Street"));
    assert.ok(lines.includes("DESCRIPTION:Bring a dish"));
    assert.ok(lines.includes("URL:https://junto.app/e/abc123"));
    assert.ok(lines.includes("ORGANIZER:mailto:dave@example.com"));
  });

  test("marks a cancelled event so calendars grey it out", () => {
    const lines = unfold(base({ cancelled: true }));
    assert.ok(lines.includes("STATUS:CANCELLED"));
    assert.ok(lines.includes("METHOD:CANCEL"));
    // A bumped sequence makes clients treat it as an update, not a new entry.
    assert.ok(lines.includes("SEQUENCE:1"));
  });

  test("a live event is confirmed and published", () => {
    const lines = unfold(base());
    assert.ok(lines.includes("STATUS:CONFIRMED"));
    assert.ok(lines.includes("METHOD:PUBLISH"));
    assert.ok(lines.includes("SEQUENCE:0"));
  });

  test("survives a name full of special characters", () => {
    const ics = base({ summary: "Sam, Kim; & co's \\ potluck" });
    const lines = unfold(ics);
    assert.ok(
      lines.includes("SUMMARY:Sam\\, Kim\\; & co's \\\\ potluck"),
      lines.find((l) => l.startsWith("SUMMARY")),
    );
    // Escaped separators must not introduce new logical lines.
    assert.equal(lines.filter((l) => l.startsWith("SUMMARY")).length, 1);
  });

  test("a very long name stays within the line limit", () => {
    const ics = base({ summary: "Potluck ".repeat(40) });
    for (const line of ics.split("\r\n")) {
      assert.ok(new TextEncoder().encode(line).length <= 75);
    }
  });
});

describe("googleCalendarUrl", () => {
  const url = (o: Partial<Parameters<typeof googleCalendarUrl>[0]> = {}) =>
    new URL(
      googleCalendarUrl({
        summary: "Meal team",
        start: START,
        end: END,
        ...o,
      }),
    );

  test("points at Google Calendar's event template", () => {
    const u = url();
    assert.equal(u.origin, "https://calendar.google.com");
    assert.equal(u.searchParams.get("action"), "TEMPLATE");
  });

  test("carries the title and the UTC start/end", () => {
    const u = url();
    assert.equal(u.searchParams.get("text"), "Meal team");
    assert.equal(u.searchParams.get("dates"), "20261128T000000Z/20261128T020000Z");
  });

  test("encodes awkward characters rather than breaking the link", () => {
    const u = url({ summary: "Food & drinks #1 / 50% off?" });
    assert.equal(u.searchParams.get("text"), "Food & drinks #1 / 50% off?");
  });

  test("includes details and location only when given", () => {
    assert.equal(url().searchParams.has("details"), false);
    assert.equal(url().searchParams.has("location"), false);
    const u = url({ details: "Bring a dish", location: "Church hall" });
    assert.equal(u.searchParams.get("details"), "Bring a dish");
    assert.equal(u.searchParams.get("location"), "Church hall");
  });
});
