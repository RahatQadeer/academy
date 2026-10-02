import type { AcademyCourseAccess, AcademyEntitlementSource } from "./domain";
import { allowsSelfPurchase } from "./programAccessPolicy";

/** True when the program charges money (price > 0). Null / 0 / invalid ⇒ not paid. */
export function isPaidProgram(price: number | string | null | undefined): boolean {
  if (price == null) return false;
  const value = Number(price);
  return Number.isFinite(value) && value > 0;
}

/** True when learners may Start without checkout (null or ≤ 0 price). */
export function isFreeProgramPrice(price: number | string | null | undefined): boolean {
  return !isPaidProgram(price);
}

/**
 * Whether an enrolled learner may open curriculum / resources.
 * - No price (or $0): enrollment is enough.
 * - Open-access catalog (Free / plan): enrollment is enough even if price is set.
 * - Purchased-access + price > 0: need purchase or admin assignment.
 */
export function learnerCanAccessProgramContent(input: {
  price: number | string | null;
  entitlementSource: AcademyEntitlementSource | null;
  enrolled: boolean;
  /** Preferred — open vs purchase mode. When omitted, paid programs unlock only via purchase/admin. */
  access?: AcademyCourseAccess | string | null;
}): boolean {
  if (!input.enrolled) return false;
  if (!isPaidProgram(input.price)) return true;

  if (input.access != null && !allowsSelfPurchase(input.access)) {
    return true;
  }

  return (
    input.entitlementSource === "purchase" || input.entitlementSource === "admin_assigned"
  );
}
