import assert from "node:assert/strict";
import test from "node:test";
import { chartInput, initialsOf, planTotals, toWhitbyPlan, trendRows } from "./plan-view.ts";
import type { PortalPlan } from "../types/index.ts";

/**
 * A shared plan is drawn with Whitby's own components, so the adapter decides
 * what those components can say. It must never invent a field the portal was
 * not sent, and it must count exactly what Whitby counts.
 */

const plan: PortalPlan = {
  id: "plan-1",
  requestId: "req-1",
  name: "Lisbon Move",
  desiredOutcome: "Settled in Lisbon",
  status: "active",
  urgency: "urgent-ish",
  health: null,
  startDate: null,
  targetDate: "2026-12-01",
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-10T10:00:00Z",
  sharedAt: "2026-09-02T10:00:00Z",
  ownerName: "Jordan Hartwell",
  streams: [
    {
      id: "s1",
      name: "Visa",
      purpose: null,
      status: "active",
      kind: "approval",
      blocked: false,
      targetDate: null,
      createdAt: null,
      ownerName: "Jordan Hartwell",
      tasks: [
        {
          id: "t1",
          title: "Book consulate",
          status: "complete",
          kind: "manual",
          dueAt: null,
          completedAt: "2026-09-05T10:00:00Z",
          createdAt: "2026-09-01T10:00:00Z",
          waiting: false,
          ownerName: "Alicia Moreau",
        },
        {
          id: "t2",
          title: "Collect bank letter",
          status: "not_started",
          kind: "approval",
          dueAt: "2026-10-01T12:00:00Z",
          completedAt: null,
          createdAt: "2026-09-01T10:00:00Z",
          waiting: true,
          ownerName: null,
        },
      ],
    },
  ],
};

test("nothing the portal was not sent is filled in", () => {
  const detail = toWhitbyPlan(plan, "Relocate");
  const [first] = detail.workstreams[0]!.tasks;
  assert.equal(first!.priority, null);
  assert.deepEqual(first!.checklist, []);
  assert.equal(first!.blockedByStreamId, null);
  assert.equal(first!.blockedByTaskId, null);
  assert.equal(first!.ownerUserId, null);
  assert.equal(first!.ownerHasPhoto, false);
  assert.equal(detail.workstreams[0]!.tasks[1]!.waiting_state, null);
  assert.deepEqual(detail.dependencyLines, []);
  assert.deepEqual(detail.considerations, []);
  assert.equal(detail.providerCount, 0);
});

test("counts and approvals are Whitby's", () => {
  const detail = toWhitbyPlan(plan, "Relocate");
  assert.equal(detail.taskDone, 1);
  assert.equal(detail.taskTotal, 2);
  assert.equal(detail.progress, 50);
  assert.equal(detail.approvalsWaiting, 1);
  assert.equal(detail.request_title, "Relocate");
});

test("an urgency or health the check constraint would reject reads as the default", () => {
  const detail = toWhitbyPlan(plan, "Relocate");
  assert.equal(detail.urgency, "medium");
  assert.equal(detail.health, "on_track");
});

test("waiting reaches the charts as a state and never as words", () => {
  const input = chartInput(plan);
  assert.deepEqual(input.tasks.map((task) => task.waiting_state), [null, "waiting"]);
  assert.deepEqual(input.tasks.map((task) => task.workstream_id), ["s1", "s1"]);
});

test("step counts and trend rows cover every task of every shared plan", () => {
  assert.deepEqual(planTotals([plan, plan]), { done: 2, total: 4 });
  assert.equal(trendRows(plan).length, 2);
  assert.equal(initialsOf("Alicia Moreau"), "AM");
  assert.equal(initialsOf(null), null);
});
