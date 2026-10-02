import assert from "node:assert/strict";
import test from "node:test";
import {
  computeReversalDelta,
  effectiveEarningAmount,
  isFullReversal,
} from "./reversal-math.ts";

test("computeReversalDelta full refund on percentage earning", () => {
  const delta = computeReversalDelta(10, 10000, 10000, 0);
  assert.equal(delta, -10);
});

test("computeReversalDelta partial refund is proportional", () => {
  const delta = computeReversalDelta(10, 5000, 10000, 0);
  assert.equal(delta, -5);
});

test("computeReversalDelta incremental after prior adjustment", () => {
  const first = computeReversalDelta(10, 5000, 10000, 0);
  assert.equal(first, -5);
  const second = computeReversalDelta(10, 10000, 10000, first);
  assert.equal(second, -5);
});

test("computeReversalDelta returns zero when already fully adjusted", () => {
  const delta = computeReversalDelta(10, 10000, 10000, -10);
  assert.equal(delta, 0);
});

test("isFullReversal", () => {
  assert.equal(isFullReversal(10000, 10000), true);
  assert.equal(isFullReversal(15000, 10000), true);
  assert.equal(isFullReversal(5000, 10000), false);
});

test("effectiveEarningAmount sums base and adjustments", () => {
  assert.equal(effectiveEarningAmount(10, -3), 7);
  assert.equal(effectiveEarningAmount(10, -10), 0);
});
