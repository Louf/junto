import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  DATE_FORMATS,
  FALLBACK_TZ,
  eventZone,
  formatEventDate,
  isValidZone,
} from "./dates.ts";

/** 6:00 PM in Chicago on Friday 27 November 2026. */
const POTLUCK = "2026-11-28T00:00:00.000Z";

describe("formatEventDate", () => {
  test("renders the event's local time, not the runtime's", () => {
    // The regression this exists to prevent: on a UTC host, date-fns' format()
    // printed this as "Saturday, November 28 at 12:00 AM" — wrong time and
    // wrong day.
    assert.equal(
      formatEventDate(POTLUCK, "America/Chicago", "long"),
      "Friday, November 27 at 6:00 PM CST",
    );
  });

  test("is stable no matter what timezone the process is in", () => {
    const expected = formatEventDate(POTLUCK, "America/Chicago", "long");
    const original = process.env.TZ;

    try {
      for (const tz of ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"]) {
        process.env.TZ = tz;
        assert.equal(
          formatEventDate(POTLUCK, "America/Chicago", "long"),
          expected,
          `drifted when the process ran in ${tz}`,
        );
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  test("renders the same instant differently per event zone", () => {
    assert.equal(
      formatEventDate(POTLUCK, "America/New_York", "long"),
      "Friday, November 27 at 7:00 PM EST",
    );
    assert.match(formatEventDate(POTLUCK, "Europe/London", "long"), /Saturday, November 28/);
  });

  test("accepts a Date as well as an ISO string", () => {
    assert.equal(
      formatEventDate(new Date(POTLUCK), "America/Chicago", "long"),
      formatEventDate(POTLUCK, "America/Chicago", "long"),
    );
  });

  test("every pattern renders without throwing", () => {
    for (const key of Object.keys(DATE_FORMATS) as (keyof typeof DATE_FORMATS)[]) {
      const out = formatEventDate(POTLUCK, "America/Chicago", key);
      assert.ok(out.length > 0, `${key} produced nothing`);
    }
  });

  test("patterns that people act on carry the zone abbreviation", () => {
    // A link shared across states shouldn't be misreadable by an hour.
    assert.match(formatEventDate(POTLUCK, "America/Chicago", "long"), /CST$/);
    assert.match(formatEventDate(POTLUCK, "America/Chicago", "timeOnly"), /CST$/);
    assert.match(formatEventDate(POTLUCK, "America/Chicago", "preview"), /CST$/);
  });
});

describe("eventZone", () => {
  test("falls back for rows created before the column existed", () => {
    assert.equal(eventZone(null), FALLBACK_TZ);
    assert.equal(eventZone(undefined), FALLBACK_TZ);
    assert.equal(eventZone(""), FALLBACK_TZ);
    assert.equal(eventZone("   "), FALLBACK_TZ);
  });

  test("passes a real zone through", () => {
    assert.equal(eventZone("America/Chicago"), "America/Chicago");
  });

  test("a fallback event is labelled UTC rather than silently wrong", () => {
    assert.match(formatEventDate(POTLUCK, null, "long"), /UTC$/);
  });
});

describe("isValidZone", () => {
  test("accepts IANA zones", () => {
    for (const tz of ["America/Chicago", "Europe/London", "Asia/Tokyo", "UTC"]) {
      assert.equal(isValidZone(tz), true, `${tz} should be valid`);
    }
  });

  test("rejects junk, so a bad value never reaches the database", () => {
    for (const tz of ["Mars/Olympus", "not a zone", "", "GMT+25"]) {
      assert.equal(isValidZone(tz), false, `${tz} should be rejected`);
    }
  });
});

describe("daylight saving", () => {
  test("picks the right abbreviation either side of the switch", () => {
    // Chicago is CDT in July and CST in January.
    assert.match(
      formatEventDate("2026-07-15T23:00:00.000Z", "America/Chicago", "timeOnly"),
      /CDT$/,
    );
    assert.match(
      formatEventDate("2026-01-15T23:00:00.000Z", "America/Chicago", "timeOnly"),
      /CST$/,
    );
  });
});
