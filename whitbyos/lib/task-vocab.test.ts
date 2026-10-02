import assert from "node:assert/strict";
import { test } from "node:test";
import { dueLabel } from "./task-vocab.ts";

/**
 * Screen 7's Due column, which is read down a list of two hundred rows.
 *
 * Every one of these is a boundary: the day it changes wording, and the two
 * where it changes unit. They are here because the column said "Overdue" on
 * thirteen rows in a row before this, and saying how late instead is only
 * worth anything if the number is right.
 */
const NOW = new Date("2026-09-16T12:00:00Z");

const on = (day: string) => dueLabel(day, "not_started", NOW);

test("a date in the future is the date", () => {
  assert.deepEqual(on("2026-10-02"), { text: "Oct 2", tone: "muted" });
});

test("today and tomorrow are named rather than dated", () => {
  assert.deepEqual(on("2026-09-16"), { text: "Today", tone: "ink" });
  assert.deepEqual(on("2026-09-17"), { text: "Tomorrow", tone: "ink" });
});

test("late says how late, in the unit that reads best", () => {
  assert.equal(on("2026-09-15")?.text, "1 day late");
  assert.equal(on("2026-09-04")?.text, "12 days late");
  // 13 days is the last one counted in days, 14 the first in weeks.
  assert.equal(on("2026-09-03")?.text, "13 days late");
  assert.equal(on("2026-09-02")?.text, "2 weeks late");
  assert.equal(on("2026-08-08")?.text, "6 weeks late");
  // 59 days is the last in weeks, 60 the first in months.
  assert.equal(on("2026-07-19")?.text, "8 weeks late");
  assert.equal(on("2026-07-18")?.text, "2 months late");
});

test("anything late is drawn in danger, whatever the unit", () => {
  assert.equal(on("2026-09-15")?.tone, "danger");
  assert.equal(on("2026-07-18")?.tone, "danger");
});

test("a finished task is never late, however old its date", () => {
  const done = dueLabel("2026-01-01", "complete", NOW);
  assert.equal(done?.tone, "muted");
  assert.equal(done?.text, "Jan 1");
});

test("no date says nothing rather than guessing one", () => {
  assert.equal(dueLabel(null, "not_started", NOW), null);
  assert.equal(dueLabel("", "not_started", NOW), null);
  assert.equal(dueLabel("not a date", "not_started", NOW), null);
});
