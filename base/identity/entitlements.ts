import { PRODUCTS, SWITCHER_UNENTITLED } from "@/base/switcher/products";
import type { Entitlement, ProductKey } from "@/base/types";

const ACTIVE_STATUSES = new Set(["active", "trial"]);

export function getActiveProducts(entitlements: Entitlement[]): ProductKey[] {
  return entitlements
    .filter((item) => ACTIVE_STATUSES.has(item.status))
    .map((item) => item.product);
}

export function resolveLandingPath(entitlements: Entitlement[]): string | null {
  const active = entitlements.filter((item) => ACTIVE_STATUSES.has(item.status));
  if (active.length === 0) return null;

  const defaultLanding = active.find((item) => item.is_default_landing);
  if (defaultLanding) {
    return PRODUCTS.find((product) => product.key === defaultLanding.product)?.href ?? null;
  }

  if (active.length === 1) {
    return PRODUCTS.find((product) => product.key === active[0]!.product)?.href ?? null;
  }

  return "/switcher";
}

export function visibleProducts(entitlements: Entitlement[]) {
  const active = new Set(getActiveProducts(entitlements));
  if (SWITCHER_UNENTITLED === "hide") {
    return PRODUCTS.filter((product) => active.has(product.key));
  }
  return PRODUCTS;
}

export function productState(
  key: ProductKey,
  entitlements: Entitlement[],
): "available" | "inactive" {
  const active = new Set(getActiveProducts(entitlements));
  return active.has(key) ? "available" : "inactive";
}
