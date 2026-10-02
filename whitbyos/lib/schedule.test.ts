import assert from "node:assert/strict";
import { test } from "node:test";
import { addBusinessDays, businessDaysBetween, schedulePlan } from "./schedule.ts";

/** A visa application, which is the case this was written for. */
const CHAIN = [
  { key: "identify", estimatedDays: 1, dependsOn: null, phase: 0, order: 0 },
  { key: "requirements", estimatedDays: 1, dependsOn: "identify", phase: 0, order: 1 },
  { key: "documents", estimatedDays: 3, dependsOn: "requirements", phase: 1, order: 0 },
  { key: "prepare", estimatedDays: 2, dependsOn: "documents", phase: 2, order: 0 },
  { key: "review", estimatedDays: 1, dependsOn: "prepare", phase: 2, order: 1 },
  { key: "submit", estimatedDays: 1, dependsOn: "review", phase: 3, order: 0 },
];

test("weekends are never worked", () => {
  // 2026-09-18 is a Friday. One business day on is the Monday.
  const monday = addBusinessDays(new Date("2026-09-18T12:00:00Z"), 1);
  assert.equal(monday.toISOString().slice(0, 10), "2026-09-21");
  assert.equal(businessDaysBetween(new Date("2026-09-18T12:00:00Z"), monday), 1);
});

test("the last task lands on the deadline, not after it", () => {
  const { tasks, feasibility } = schedulePlan({
    tasks: CHAIN,
    targetDate: "2026-09-30",
    from: "2026-09-01",
  });

  const submit = tasks.find((task) => task.key === "submit")!;
  assert.equal(submit.dueDate, "2026-09-30");
  assert.equal(feasibility.fits, true);
  assert.equal(feasibility.shortfallDays, 0);
});

test("work runs in order, each task after the one it waits on", () => {
  const { tasks } = schedulePlan({
    tasks: CHAIN,
    targetDate: "2026-09-30",
    from: "2026-09-01",
  });

  const at = (key: string) => tasks.find((task) => task.key === key)!;
  for (const [before, after] of [
    ["identify", "requirements"],
    ["requirements", "documents"],
    ["documents", "prepare"],
    ["prepare", "review"],
    ["review", "submit"],
  ] as const) {
    assert.ok(
      at(before).dueDate < at(after).startDate,
      `${before} must finish before ${after} starts`,
    );
  }
});

test("slack sits at the front, so the plan starts late rather than early", () => {
  // Nine business days of work with a month to do it in: the first task should
  // not be scheduled for today.
  const { tasks } = schedulePlan({
    tasks: CHAIN,
    targetDate: "2026-09-30",
    from: "2026-09-01",
  });

  assert.ok(
    tasks.find((task) => task.key === "identify")!.startDate > "2026-09-01",
    "a plan with room to spare should not start immediately",
  );
});

test("too little time is reported rather than hidden", () => {
  const { feasibility, tasks } = schedulePlan({
    tasks: CHAIN,
    targetDate: "2026-09-04",
    from: "2026-09-01",
  });

  assert.equal(feasibility.fits, false);
  assert.ok(feasibility.shortfallDays > 0, "a shortfall should be counted");
  assert.deepEqual(feasibility.criticalPath, [
    "identify",
    "requirements",
    "documents",
    "prepare",
    "review",
    "submit",
  ]);

  // Even when it does not fit, every date is one somebody can act on.
  for (const task of tasks) {
    assert.ok(task.startDate >= "2026-09-01", `${task.key} must not start in the past`);
  }
});

test("independent work is marked as able to run alongside", () => {
  const { feasibility } = schedulePlan({
    tasks: [
      ...CHAIN,
      // Nothing waits on this, so it has slack.
      { key: "book-courier", estimatedDays: 1, dependsOn: null, phase: 1, order: 1 },
    ],
    targetDate: "2026-09-30",
    from: "2026-09-01",
  });

  assert.ok(feasibility.parallelisable.includes("book-courier"));
  assert.ok(!feasibility.criticalPath.includes("book-courier"));
});

test("a dependency loop costs one edge, not the schedule", () => {
  const { tasks } = schedulePlan({
    tasks: [
      { key: "a", estimatedDays: 1, dependsOn: "b", phase: 0, order: 0 },
      { key: "b", estimatedDays: 1, dependsOn: "a", phase: 0, order: 1 },
    ],
    targetDate: "2026-09-30",
    from: "2026-09-01",
  });

  assert.equal(tasks.length, 2, "both tasks are still scheduled");
});

test("a deadline on a weekend is reported as the working day it was moved to", () => {
  // 2026-10-10 is a Saturday. Nobody works to a Saturday deadline, so the
  // plan is laid back from the Friday — and `targetDate` comes back as that
  // Friday, not as the date somebody typed.
  //
  // The plan header shows what was typed and this shows what was planned to,
  // so the screen carried two dates and explained neither. The banner now
  // says which is which; this pins the behaviour it explains.
  const { feasibility } = schedulePlan({
    tasks: CHAIN,
    targetDate: "2026-10-10",
    from: "2026-09-30",
  });

  assert.equal(feasibility.targetDate, "2026-10-09");
  assert.notEqual(feasibility.targetDate, "2026-10-10");
});

test("a deadline on a working day is left where it is", () => {
  // 2026-10-09 is a Friday, so nothing moves and the banner stays quiet.
  const { feasibility } = schedulePlan({
    tasks: CHAIN,
    targetDate: "2026-10-09",
    from: "2026-09-30",
  });

  assert.equal(feasibility.targetDate, "2026-10-09");
});

/**
 * The longest chain is a measure of work, not of pressure.
 *
 * Test 07 was due in March 2027 and finished in November 2026, so every task
 * had slack and none was "critical" in the textbook sense. The plan reported
 * "0 working days of work on the longest chain" over eleven tasks and
 * thirty-one days of work.
 */
test("a distant deadline does not make the longest chain zero", () => {
  const { feasibility } = schedulePlan({
    tasks: CHAIN,
    targetDate: "2027-03-26",
    from: "2026-09-01",
  });

  assert.ok(feasibility.fits);
  /* Every day of the chain: 1 + 1 + 3 + 2 + 1 + 1. */
  assert.equal(feasibility.criticalPathDays, 9);
  assert.deepEqual(feasibility.criticalPath, [
    "identify",
    "requirements",
    "documents",
    "prepare",
    "review",
    "submit",
  ]);
});

test("the chain measured is the longest one, not the first", () => {
  const { feasibility } = schedulePlan({
    tasks: [
      { key: "short", estimatedDays: 1, dependsOn: null, phase: 0, order: 0 },
      { key: "a", estimatedDays: 4, dependsOn: null, phase: 0, order: 1 },
      { key: "b", estimatedDays: 4, dependsOn: "a", phase: 0, order: 2 },
    ],
    targetDate: "2027-03-26",
    from: "2026-09-01",
  });

  assert.equal(feasibility.criticalPathDays, 8);
  assert.deepEqual(feasibility.criticalPath, ["a", "b"]);
});

test("a task that depends on itself does not hang the walk", () => {
  const { feasibility } = schedulePlan({
    tasks: [
      { key: "loop", estimatedDays: 2, dependsOn: "loop", phase: 0, order: 0 },
      { key: "after", estimatedDays: 1, dependsOn: "loop", phase: 0, order: 1 },
    ],
    targetDate: "2027-03-26",
    from: "2026-09-01",
  });

  assert.ok(feasibility.criticalPathDays > 0);
  assert.ok(feasibility.criticalPath.length <= 2);
});
