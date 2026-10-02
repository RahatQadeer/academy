import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCalloutMarkdown,
  normalizeCalloutMarkdown,
  unwrapCalloutSource,
} from "./calloutMarkup.ts";

test("unwraps nested [info] [Important: body.] into a plain sentence", () => {
  const parsed = unwrapCalloutSource(
    "[info] [Important: A test report is not a pass/fail document. It is a set of constraints.]",
  );
  assert.equal(parsed.variant, "important");
  assert.equal(
    parsed.text,
    "A test report is not a pass/fail document. It is a set of constraints.",
  );
  assert.equal(parsed.text.includes("["), false);
  assert.equal(parsed.text.includes("]"), false);
});

test("unwraps a single [Important: body.] wrapper", () => {
  const parsed = unwrapCalloutSource(
    "[Important: A test report is a set of constraints, not a pass/fail document.]",
  );
  assert.equal(parsed.variant, "important");
  assert.equal(parsed.text, "A test report is a set of constraints, not a pass/fail document.");
});

test("formatCalloutMarkdown never emits nested or wrapping brackets around the body", () => {
  const line = formatCalloutMarkdown("info", "[Important: Pre-shrink the yardage before you cut.]");
  assert.equal(line, "[Important] Pre-shrink the yardage before you cut.");
});

test("normalizeCalloutMarkdown rewrites stored callout syntax for display", () => {
  const cleaned = normalizeCalloutMarkdown(
    "[info] [Important: A test report is not a pass/fail document. It is a set of constraints.]",
  );
  assert.equal(
    cleaned,
    "[Important] A test report is not a pass/fail document. It is a set of constraints.",
  );
});
