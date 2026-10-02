import assert from "node:assert/strict";
import test from "node:test";
import {
  isEligibleOpportunityStatus,
  isWithinProtectionPeriod,
  validateOpportunityPaymentEligibility,
} from "./opportunity-payment-eligibility.ts";

test("isEligibleOpportunityStatus accepts accepted, in_progress, converted", () => {
  assert.equal(isEligibleOpportunityStatus("accepted"), true);
  assert.equal(isEligibleOpportunityStatus("in_progress"), true);
  assert.equal(isEligibleOpportunityStatus("converted"), true);
  assert.equal(isEligibleOpportunityStatus("submitted"), false);
});

test("isWithinProtectionPeriod", () => {
  const eventTime = new Date("2026-06-01T12:00:00.000Z");
  assert.equal(
    isWithinProtectionPeriod("2026-12-01T00:00:00.000Z", eventTime),
    true,
  );
  assert.equal(
    isWithinProtectionPeriod("2026-01-01T00:00:00.000Z", eventTime),
    false,
  );
  assert.equal(isWithinProtectionPeriod(null, eventTime), false);
});

test("validateOpportunityPaymentEligibility rejects submitted status", () => {
  const result = validateOpportunityPaymentEligibility({
    status: "submitted",
    protectedUntil: "2026-12-01T00:00:00.000Z",
    eventTime: new Date("2026-06-01T12:00:00.000Z"),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /not eligible/i);
  }
});

test("validateOpportunityPaymentEligibility rejects expired protection", () => {
  const result = validateOpportunityPaymentEligibility({
    status: "accepted",
    protectedUntil: "2026-01-01T00:00:00.000Z",
    eventTime: new Date("2026-06-01T12:00:00.000Z"),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /protected attribution period/i);
  }
});

test("validateOpportunityPaymentEligibility accepts eligible opportunity", () => {
  const result = validateOpportunityPaymentEligibility({
    status: "converted",
    protectedUntil: "2026-12-01T00:00:00.000Z",
    eventTime: new Date("2026-06-01T12:00:00.000Z"),
  });
  assert.equal(result.ok, true);
});
