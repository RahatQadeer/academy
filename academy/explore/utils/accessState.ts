import type {
  AcademyCourseAccess,
  AcademyEnrollmentStatus,
  AcademyEntitlementSource,
  AcademyProgramType,
} from "@/academy/lib/domain";
import {
  allowsOpenEnrollment,
  allowsSelfPurchase,
  programAccessMeta,
} from "@/academy/lib/programAccessPolicy";
import { lessonPlayerHref } from "@/academy/lesson-player/utils/curriculum";
import { checkoutSessionHref, programCheckoutHref } from "@/academy/enrollment/utils/checkoutHref";
import { formatCheckoutAmount } from "@/academy/enrollment/utils/payment";
import type { ProgramAccessState } from "../types";

function programDetailHref(programId: string) {
  return `/academy/explore/${programId}`;
}

export function isFreeProgram(price: number | string | null | undefined): boolean {
  if (price == null || price === "") return true;
  const value = Number(price);
  return !Number.isFinite(value) || value <= 0;
}

export function formatProgramPrice(price: number | string | null | undefined): string {
  if (isFreeProgram(price)) return "Free";
  return formatCheckoutAmount(Number(price));
}

function enrollmentBadge(source: AcademyEntitlementSource | null | undefined): string | null {
  if (source === "admin_assigned") return "Assigned to you";
  if (source === "purchase") return "Purchased";
  if (source === "free") return "Enrolled";
  if (source === "prerequisite_met") return "Unlocked";
  return null;
}

/**
 * Resolves Explore / detail CTAs.
 * All course types are open to Academy learners — no prerequisite gate.
 * Purchased access with a price → Purchase; otherwise → Start.
 */
export function resolveProgramAccess(input: {
  programId: string;
  type: AcademyProgramType;
  access: AcademyCourseAccess;
  price: number | null;
  enrollmentStatus: AcademyEnrollmentStatus | null;
  /** Ignored — prerequisites do not block access. */
  prerequisiteMet?: boolean;
  pendingCheckoutId?: string | null;
  entitlementSource?: AcademyEntitlementSource | null;
  prerequisiteName?: string | null;
}): ProgramAccessState {
  const href = programDetailHref(input.programId);
  const playerHref = lessonPlayerHref(input.programId);
  const checkoutHref = input.pendingCheckoutId
    ? checkoutSessionHref(input.pendingCheckoutId)
    : programCheckoutHref(input.programId);
  const meta = programAccessMeta(input.access);

  if (input.enrollmentStatus === "completed") {
    return {
      kind: "completed",
      label: "Review",
      href: playerHref,
      muted: false,
      badge: enrollmentBadge(input.entitlementSource) ?? "Completed",
    };
  }
  if (input.enrollmentStatus === "in_progress") {
    return {
      kind: "in_progress",
      label: "Continue",
      href: playerHref,
      muted: false,
      badge: enrollmentBadge(input.entitlementSource),
    };
  }
  if (input.enrollmentStatus === "enrolled") {
    return {
      kind: "enrolled",
      label: "Continue",
      href: playerHref,
      muted: false,
      badge: enrollmentBadge(input.entitlementSource),
    };
  }

  if (allowsSelfPurchase(input.access) && !isFreeProgram(input.price)) {
    return {
      kind: "purchase",
      label: input.pendingCheckoutId ? "Complete payment" : "Purchase",
      href: checkoutHref,
      muted: false,
      badge: input.pendingCheckoutId ? "Payment due" : formatProgramPrice(input.price),
    };
  }

  // Free, plan-included, organization-assigned, or purchased-without-price → Start.
  if (allowsOpenEnrollment(input.access) || isFreeProgram(input.price)) {
    return {
      kind: "available",
      label: "Start",
      href,
      muted: false,
      badge:
        input.access === "free"
          ? "Free"
          : input.access === "professional_plus"
            ? "Professional+"
            : meta.accessMode === "purchase"
              ? "Open"
              : "Included",
    };
  }

  return {
    kind: "available",
    label: "Start",
    href,
    muted: false,
    badge: "Open",
  };
}
