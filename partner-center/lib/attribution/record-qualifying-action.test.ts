import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConvertedReferralUpdate,
  outcomeAfterConvertThenEarn,
  shouldHealConvertedStatus,
} from "./referral-conversion-flow.ts";

test("commissionable paid action stays converted when earning fails", () => {
  const outcome = outcomeAfterConvertThenEarn({
    ok: false,
    error: "No commission rule configured for this program.",
  });
  assert.equal(outcome.referralStatus, "converted");
  assert.equal(outcome.earningId, undefined);
  assert.match(outcome.earningError ?? "", /commission rule/i);
});

test("commissionable paid action keeps earning id when earning succeeds", () => {
  const outcome = outcomeAfterConvertThenEarn({
    ok: true,
    earningId: "earning-1",
  });
  assert.equal(outcome.referralStatus, "converted");
  assert.equal(outcome.earningId, "earning-1");
  assert.equal(outcome.earningError, undefined);
});

test("skipped earning still counts as converted without error", () => {
  const outcome = outcomeAfterConvertThenEarn({
    ok: false,
    skipped: true,
    earningId: "earning-ineligible",
  });
  assert.equal(outcome.referralStatus, "converted");
  assert.equal(outcome.earningId, "earning-ineligible");
  assert.equal(outcome.earningError, undefined);
});

test("duplicate payment with existing earning heals in_progress/referred", () => {
  assert.equal(shouldHealConvertedStatus("in_progress"), true);
  assert.equal(shouldHealConvertedStatus("referred"), true);
  assert.equal(shouldHealConvertedStatus("converted"), false);
  assert.equal(shouldHealConvertedStatus("not_converted"), false);
});

test("non-commissionable trial does not use convert-then-earn outcome", () => {
  // Trial path only advances referred → in_progress in recordQualifyingAction;
  // convert helpers are unused. Guard the update shape for paid conversion.
  const update = buildConvertedReferralUpdate(
    new Date("2026-09-22T10:07:00.000Z"),
    "price_standard",
  );
  assert.equal(update.status, "converted");
  assert.equal(update.conversion_event_date, "2026-09-22");
  assert.equal(update.product, "price_standard");
});
