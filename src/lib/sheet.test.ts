import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  LABEL_MAX,
  MAX_COLUMNS,
  NAME_MAX,
  cleanName,
  cleanNote,
  nameKey,
  parseColumns,
  parseNames,
} from "./sheet.ts";

describe("parseNames", () => {
  test("takes one name per line", () => {
    assert.deepEqual(parseNames("Sarah Jones\nMike Chen\n"), [
      "Sarah Jones",
      "Mike Chen",
    ]);
  });

  test("accepts a comma-separated list pasted from a chat", () => {
    assert.deepEqual(parseNames("Sarah, Mike; Priya"), ["Sarah", "Mike", "Priya"]);
  });

  test("drops blank lines and tidies whitespace", () => {
    assert.deepEqual(parseNames("\n  Sarah   Jones \n\n\tMike\n"), [
      "Sarah Jones",
      "Mike",
    ]);
  });

  test("keeps the first of a case-insensitive duplicate", () => {
    assert.deepEqual(parseNames("Sarah\nsarah\nSARAH "), ["Sarah"]);
  });

  test("skips names already on the sheet", () => {
    assert.deepEqual(parseNames("Sarah\nMike", ["mike"]), ["Sarah"]);
  });

  test("handles Windows line endings", () => {
    assert.deepEqual(parseNames("Sarah\r\nMike\r\n"), ["Sarah", "Mike"]);
  });
});

describe("cleanName / nameKey", () => {
  test("caps very long names", () => {
    assert.equal(cleanName("x".repeat(500)).length, NAME_MAX);
  });

  test("treats spacing and case as the same person", () => {
    assert.equal(nameKey("  Sarah  JONES "), nameKey("sarah jones"));
  });
});

describe("parseColumns", () => {
  test("trims and keeps order", () => {
    assert.deepEqual(parseColumns([" Food ", "Serve", "Money"]), {
      ok: true,
      labels: ["Food", "Serve", "Money"],
    });
  });

  test("ignores blank entries", () => {
    assert.deepEqual(parseColumns(["Food", "  ", ""]), {
      ok: true,
      labels: ["Food"],
    });
  });

  test("needs at least one column", () => {
    assert.equal(parseColumns(["", " "]).ok, false);
    assert.equal(parseColumns("Food").ok, false);
  });

  test("rejects the same label twice, ignoring case", () => {
    const res = parseColumns(["Food", "food"]);
    assert.equal(res.ok, false);
  });

  test("caps the number of columns", () => {
    const many = Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `C${i}`);
    assert.equal(parseColumns(many).ok, false);
  });

  test("shortens overlong labels", () => {
    const res = parseColumns(["y".repeat(100)]);
    assert.ok(res.ok && res.labels[0].length === LABEL_MAX);
  });
});

describe("cleanNote", () => {
  test("empty becomes null", () => {
    assert.equal(cleanNote("   "), null);
  });

  test("keeps a short note", () => {
    assert.equal(cleanNote(" Lasagna  for 8 "), "Lasagna for 8");
  });
});
