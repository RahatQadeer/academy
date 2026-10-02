import assert from "node:assert/strict";
import { test } from "node:test";
import { approvalsWaiting, streamDependencies } from "./plan-derive.ts";
import type { PlanTask, PlanWorkstream } from "./work-plans.ts";

/**
 * A plan shaped the way drafting actually produces one.
 *
 * This is the whole point of the fixture. Whitby classifies *tasks* as
 * approvals and links *tasks* to the tasks they follow. The stream-level
 * fields — a Work Stream's own `kind`, and `blockedByStreamId` — exist in the
 * schema and are never written by drafting.
 *
 * Two screens read those stream-level fields and so reported nothing on plans
 * that were full of both. Written this way, a derivation that goes back to
 * reading them fails here instead of on somebody's plan.
 */
function task(id: string, over: Partial<PlanTask> = {}): PlanTask {
  return {
    id,
    title: id,
    status: "not_started",
    kind: "manual",
    priority: null,
    due_date: null,
    completed_at: null,
    waiting_state: null,
    ownerInitials: null,
    ownerName: null,
    ownerUserId: null,
    ownerHasPhoto: false,
    checklist: [],
    // Never set by drafting. Present so a test that relies on it is visibly
    // relying on something the product does not produce.
    blockedByStreamId: null,
    blockedByTaskId: null,
    description: null,
    rationale: null,
    startDate: null,
    estimatedDays: 1,
    expectedOutput: null,
    requiredInputs: [],
    externalLinks: [],
    providerId: null,
    providerNeed: null,
    ...over,
  };
}

function stream(id: string, name: string, tasks: PlanTask[]): PlanWorkstream {
  return {
    id,
    name,
    purpose: null,
    status: "not_started",
    // Likewise: drafting leaves every stream "manual".
    kind: "manual",
    blocked: false,
    ownerName: null,
    ownerInitials: null,
    ownerUserId: null,
    ownerHasPhoto: false,
    tasks,
  };
}

const RESEARCH = stream("s1", "Research & Discovery", [
  task("interview"),
  task("analyse", { blockedByTaskId: "interview" }),
  task("audit", { blockedByTaskId: "interview", status: "complete" }),
]);

const STRATEGY = stream("s2", "Strategy Development", [
  task("draft", { blockedByTaskId: "analyse" }),
  task("sign-off", { kind: "approval", blockedByTaskId: "draft" }),
]);

const COMPLIANCE = stream("s3", "Compliance", [
  task("review", { kind: "approval" }),
  task("cleared", { kind: "approval", status: "complete" }),
]);

const PLAN = [RESEARCH, STRATEGY, COMPLIANCE];
const ALL = PLAN.flatMap((row) => row.tasks);

test("approvals are counted on the tasks, which is where drafting puts them", () => {
  const waiting = approvalsWaiting(ALL);

  // Two open approvals; the finished one does not count, and no Work Stream
  // anywhere is of kind "approval".
  assert.deepEqual(
    waiting.map((row) => row.id),
    ["sign-off", "review"],
  );
  assert.ok(PLAN.every((row) => row.kind !== "approval"));
});

test("a stream waiting on another says so", () => {
  const strategy = streamDependencies(PLAN, "s2");
  assert.deepEqual(strategy.blockedBy, ["Research & Discovery"]);
});

test("a stream holding another up says so", () => {
  const research = streamDependencies(PLAN, "s1");
  assert.deepEqual(research.blocks, ["Strategy Development"]);
});

test("a stream's own order is not a dependency on somebody else", () => {
  const research = streamDependencies(PLAN, "s1");

  // Two of its three follow earlier work inside it, and that is not the same
  // fact as waiting on another Work Stream.
  assert.equal(research.internalWaits, 2);
  assert.deepEqual(research.blockedBy, []);
});

test("a stream with no links in either direction reports none", () => {
  const compliance = streamDependencies(PLAN, "s3");
  assert.deepEqual(compliance, { blockedBy: [], blocks: [], internalWaits: 0 });
});

test("nothing here depends on the stream-level fields drafting never writes", () => {
  // The guard: every task in the fixture leaves `blockedByStreamId` null, so a
  // derivation reading it would return nothing and the tests above would fail.
  assert.ok(ALL.every((row) => row.blockedByStreamId === null));
});
