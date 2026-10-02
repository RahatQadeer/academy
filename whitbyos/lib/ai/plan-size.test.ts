import assert from "node:assert/strict";
import { test } from "node:test";
import { limitsFor, sizeInstruction, trimPlan, trimNote } from "./plan-size.ts";

/**
 * The size a professional chose, enforced.
 *
 * WP.4 has asked for this since it was built and nothing had ever made it
 * true. The brief that prompted these tests is blunt about the result: Work
 * Plans coming back with ten to fifteen items whatever anybody picked.
 */

const plan = (shape: number[]) => ({
  workStreams: shape.map((steps, i) => ({
    name: `stream ${i}`,
    steps: Array.from({ length: steps }, (_, s) => `step ${i}.${s}`),
  })),
});

test("every size carries real numbers, including the default", () => {
  assert.deepEqual(limitsFor("lean"), { streams: 3, steps: 3 });
  assert.deepEqual(limitsFor("standard"), { streams: 4, steps: 4 });
  assert.deepEqual(limitsFor("comprehensive"), { streams: 6, steps: 6 });
});

test("an unknown or missing size falls back to standard, never to no limit", () => {
  assert.deepEqual(limitsFor(null), { streams: 4, steps: 4 });
  assert.deepEqual(limitsFor(undefined), { streams: 4, steps: 4 });
  assert.deepEqual(limitsFor("enormous"), { streams: 4, steps: 4 });
  assert.deepEqual(limitsFor("LEAN"), { streams: 3, steps: 3 });
});

test("the instruction is built from the same numbers it enforces", () => {
  assert.ok(sizeInstruction("lean").includes("at most 3 Work Streams"));
  assert.ok(sizeInstruction("lean").includes("at most 3 steps"));
  assert.ok(sizeInstruction("comprehensive").includes("at most 6 Work Streams"));
});

test("a plan inside its size is returned untouched", () => {
  const { plan: out, trimmed } = trimPlan(plan([3, 2]), "standard");

  assert.deepEqual(trimmed, { streams: 0, steps: 0 });
  assert.equal(out.workStreams.length, 2);
  assert.equal(out.workStreams[0].steps.length, 3);
});

test("steps over the limit are cut, and counted", () => {
  const { plan: out, trimmed } = trimPlan(plan([6, 5]), "standard");

  assert.deepEqual(
    out.workStreams.map((s) => s.steps.length),
    [4, 4],
  );
  assert.deepEqual(trimmed, { streams: 0, steps: 3 });
});

test("streams over the limit go last, because a stream is a whole piece of work", () => {
  const { plan: out, trimmed } = trimPlan(plan([5, 5, 5, 5, 5, 5]), "lean");

  assert.equal(out.workStreams.length, 3);
  /* Three streams kept, each losing two steps; three streams dropped whole. */
  assert.deepEqual(trimmed, { streams: 3, steps: 6 });
});

test("trimming takes from the end, so dependencies named earlier survive", () => {
  const { plan: out } = trimPlan(plan([5]), "standard");

  assert.deepEqual(out.workStreams[0].steps, [
    "step 0.0",
    "step 0.1",
    "step 0.2",
    "step 0.3",
  ]);
});

test("the real complaint: twelve tasks on a standard plan become eight at most", () => {
  const { plan: out } = trimPlan(plan([5, 4, 3]), "standard");
  const tasks = out.workStreams.reduce((n, s) => n + s.steps.length, 0);

  assert.equal(tasks, 11);
  assert.ok(tasks <= 4 * 4);
});

test("nothing trimmed says nothing", () => {
  assert.equal(trimNote({ streams: 0, steps: 0 }, "standard"), null);
});

test("what was cut is said out loud, with the numbers that cut it", () => {
  const note = trimNote({ streams: 2, steps: 5 }, "lean");

  assert.ok(note?.includes("2 Work Streams"));
  assert.ok(note?.includes("5 steps"));
  assert.ok(note?.includes("at most 3 Work Streams of 3 steps"));
});

test("one of a thing is said as one", () => {
  const note = trimNote({ streams: 1, steps: 1 }, "standard");

  assert.ok(note?.includes("1 Work Stream "));
  assert.ok(note?.includes("1 step"));
  assert.ok(!note?.includes("1 Work Streams"));
});

test("a plan with no streams at all does not throw", () => {
  const { plan: out, trimmed } = trimPlan({ workStreams: [] }, "lean");

  assert.deepEqual(out.workStreams, []);
  assert.deepEqual(trimmed, { streams: 0, steps: 0 });
});
