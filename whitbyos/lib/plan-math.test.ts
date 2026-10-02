import assert from "node:assert/strict";
import test from "node:test";
import {
  computePlanCharts,
  computePlanTrends,
  computeStreamCharts,
  type ChartTask,
} from "./plan-math.ts";

/**
 * The professional's charts and the client's charts of a shared plan are both
 * drawn from these functions, so these are the numbers both sides agree on.
 */

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * DAY).toISOString();

function task(patch: Partial<ChartTask>): ChartTask {
  return {
    status: "not_started",
    waiting_state: null,
    due_date: null,
    created_at: ago(10),
    completed_at: null,
    workstream_id: "a",
    ownerName: null,
    ...patch,
  };
}

test("tasks are counted by state, by stream and by owner", () => {
  const charts = computePlanCharts({
    streams: [
      { id: "a", name: "Housing", status: "active" },
      { id: "b", name: "Schools", status: "not_started" },
    ],
    tasks: [
      task({ status: "complete", completed_at: ago(2), ownerName: "Jordan" }),
      task({ status: "in_progress", ownerName: "Jordan" }),
      task({ status: "not_started", workstream_id: "b", waiting_state: "the school" }),
      task({ status: "not_started", workstream_id: "b", due_date: ago(1) }),
    ],
    targetDate: ahead(20).slice(0, 10),
    createdAt: ago(30),
  });

  assert.equal(charts.totalTasks, 4);
  assert.equal(charts.doneTasks, 1);
  assert.equal(charts.doneThisWeek, 1);
  assert.deepEqual(charts.byState, { complete: 1, running: 1, waiting: 1, planned: 1 });
  assert.deepEqual(charts.byStream.map((row) => row.name), ["Housing", "Schools"]);
  assert.equal(charts.overdue, 1);
  assert.equal(charts.slipping, "Schools");
  assert.deepEqual(
    charts.byOwner.find((row) => row.name === "Jordan"),
    { name: "Jordan", done: 1, open: 1 },
  );
});

test("a task nobody owns is filed under Unassigned", () => {
  const charts = computePlanCharts({
    streams: [{ id: "a", name: "Housing", status: "active" }],
    tasks: [task({})],
    targetDate: null,
    createdAt: null,
  });
  assert.deepEqual(charts.byOwner, [{ name: "Unassigned", done: 0, open: 1 }]);
  assert.equal(charts.daysToTarget, null);
});

test("a stream's spark is cumulative and every stream is on the same clock", () => {
  const trends = computePlanTrends(
    ["a", "b"],
    [
      { workstream_id: "a", completed_at: ago(9) },
      { workstream_id: "b", completed_at: ago(5) },
      { workstream_id: "a", completed_at: ago(1) },
      { workstream_id: "a", completed_at: null },
    ],
  );
  const a = trends.get("a")!;
  assert.equal(a.length, 8);
  assert.equal(a[a.length - 1], 2);
  assert.ok(a.every((value, index) => index === 0 || value >= a[index - 1]!));
  assert.equal(trends.get("b")!.at(-1), 1);
});

test("no completions draws no sparks at all", () => {
  assert.equal(computePlanTrends(["a"], [{ workstream_id: "a", completed_at: null }]).size, 0);
});

test("a stream's burn-down drops by one per finished task, oldest first", () => {
  const charts = computeStreamCharts({
    tasks: [
      { status: "complete", waiting_state: null, created_at: ago(9), completed_at: ago(2), kind: "approval" },
      { status: "complete", waiting_state: null, created_at: ago(9), completed_at: ago(6), kind: "manual" },
      { status: "not_started", waiting_state: null, created_at: ago(9), completed_at: null, kind: "approval" },
    ],
    targetDate: null,
    documents: 0,
  });
  assert.deepEqual(charts.burndown.map((row) => row.open), [2, 1]);
  assert.equal(charts.approvals, 2);
  assert.equal(charts.approvalsOpen, 1);
  assert.equal(charts.cycleDays.length, 2);
});
