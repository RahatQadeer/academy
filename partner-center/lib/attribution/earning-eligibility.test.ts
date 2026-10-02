import assert from "node:assert/strict";
import test from "node:test";
import {
  checkEarningBasisAndPeriod,
  daysBetween,
  eligiblePeriodToDays,
  normalizeEarningBasis,
} from "./earning-eligibility.ts";
import {
  netEligibleCollectedCents,
  parseEligibleRevenueRules,
} from "./eligible-revenue.ts";
import {
  derivePayableDate,
  parsePaymentTerms,
  serializePaymentTerms,
} from "./payment-terms.ts";

test("normalizeEarningBasis maps aliases", () => {
  assert.equal(normalizeEarningBasis("each_payment"), "each_collected_payment");
  assert.equal(normalizeEarningBasis(null), "first_collected_payment");
});

test("first_collected_payment blocks second earning", () => {
  const result = checkEarningBasisAndPeriod({
    basis: "first_collected_payment",
    priorCommissionableCount: 1,
    daysSinceConversion: 0,
    eligiblePeriod: "one_payment",
  });
  assert.equal(result.ok, false);
});

test("each payment allowed within eligible period", () => {
  const result = checkEarningBasisAndPeriod({
    basis: "each_collected_payment",
    priorCommissionableCount: 2,
    daysSinceConversion: 10,
    eligiblePeriod: "90 days",
  });
  assert.equal(result.ok, true);
});

test("rejects outside eligible period", () => {
  const result = checkEarningBasisAndPeriod({
    basis: "each_collected_payment",
    priorCommissionableCount: 1,
    daysSinceConversion: 100,
    eligiblePeriod: "90 days",
  });
  assert.equal(result.ok, false);
});

test("eligiblePeriodToDays parses common values", () => {
  assert.equal(eligiblePeriodToDays("one_payment"), 0);
  assert.equal(eligiblePeriodToDays("3 months"), 90);
  assert.equal(eligiblePeriodToDays("unlimited"), null);
});

test("daysBetween", () => {
  assert.equal(
    daysBetween("2026-01-01", new Date("2026-01-11T00:00:00.000Z")),
    10,
  );
});

test("netEligibleCollectedCents subtracts exclusions", () => {
  const rules = parseEligibleRevenueRules({ exclude: ["tax", "overages"] });
  const net = netEligibleCollectedCents(10000, rules, {
    tax: 800,
    overages: 200,
  });
  assert.equal(net, 9000);
});

test("payment terms JSON round-trip", () => {
  const serialized = serializePaymentTerms({
    display: "Net 30",
    netDays: 30,
    holdDays: 7,
    cadence: "net",
    minPayoutDollars: 50,
  });
  const parsed = parsePaymentTerms(serialized);
  assert.equal(parsed.netDays, 30);
  assert.equal(parsed.holdDays, 7);
  assert.equal(parsed.minPayoutDollars, 50);
});

test("derivePayableDate includes hold days", () => {
  const from = new Date("2026-01-01T00:00:00.000Z");
  const terms = serializePaymentTerms({
    display: "Net 15",
    netDays: 15,
    holdDays: 5,
    cadence: "net",
    minPayoutDollars: 0,
  });
  assert.equal(derivePayableDate(terms, from), "2026-01-21");
});
