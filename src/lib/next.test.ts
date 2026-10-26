import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { safeNext } from "./next.ts";

describe("safeNext", () => {
  test("keeps a same-site path", () => {
    assert.equal(safeNext("/manage/abc?welcome=1"), "/manage/abc?welcome=1");
  });

  test("falls back when missing", () => {
    assert.equal(safeNext(""), "/me");
    assert.equal(safeNext(null), "/me");
  });

  test("refuses other sites", () => {
    assert.equal(safeNext("https://evil.example"), "/me");
    assert.equal(safeNext("//evil.example"), "/me");
    assert.equal(safeNext("/\\evil.example"), "/me");
  });
});
