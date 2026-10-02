import {
  courseAccessLabel,
  programTypeLabel,
  type AcademyCourseAccess,
  type AcademyProgramType,
} from "./domain";
import {
  DEFAULT_ACCESS_BY_TYPE,
  DEFAULT_LEARNING_PATH_BY_TYPE,
  DEFAULT_RECOGNITION_BY_TYPE,
  courseAccessOptions,
  courseRecognitionOptions,
  learningPathOptions,
  programTypeOptions,
} from "./courseMetadata";

/**
 * How a learner gets into a program — driven by Pricing (Free / Paid), stored as access.
 * Program Type (Course / Short Course / Certification / Specialty Endorsement) is separate.
 * Certificate categories are tags on recognition — not Pricing.
 *
 * Product rule (current): every published program is open to Academy learners.
 * - Free / plan tiers → Start
 * - Paid / purchased (with price) → Purchase checkout
 * Prerequisites and organization assignment do not block Explore enrollment.
 */
export type AcademyAccessMode = "open" | "purchase";

export type AcademyProgramAccessMeta = {
  access: AcademyCourseAccess;
  accessMode: AcademyAccessMode;
  accessSummary: string;
  pricePrimary: boolean;
};

export function accessModeFor(access: AcademyCourseAccess | string): AcademyAccessMode {
  if (access === "purchased") return "purchase";
  return "open";
}

export function programAccessMeta(access: AcademyCourseAccess | string): AcademyProgramAccessMeta {
  const mode = accessModeFor(access);
  const label = courseAccessLabel(access);
  if (mode === "purchase") {
    return {
      access: (access as AcademyCourseAccess) || "purchased",
      accessMode: "purchase",
      accessSummary:
        "Open to all Academy learners. When a price is set, learners purchase to unlock. Admins can still assign access.",
      pricePrimary: true,
    };
  }
  return {
    access: (isKnownAccess(access) ? access : "free") as AcademyCourseAccess,
    accessMode: "open",
    accessSummary:
      access === "free"
        ? "Open enrollment — any Academy learner can Start when published. No prerequisite."
        : `${label} — included for Academy members. Learners can Start with no prerequisite.`,
    pricePrimary: false,
  };
}

function isKnownAccess(value: string): value is AcademyCourseAccess {
  return (
    value === "free" ||
    value === "standard_plus" ||
    value === "professional_plus" ||
    value === "teams_plus" ||
    value === "purchased" ||
    value === "organization_assigned"
  );
}

/** @deprecated Prefer programAccessMeta(access). Kept for gradual call-site migration. */
export function programTypeMeta(type: AcademyProgramType | string) {
  const courseType = (type as AcademyProgramType) || "course";
  const access = DEFAULT_ACCESS_BY_TYPE[courseType as AcademyProgramType] ?? "free";
  const meta = programAccessMeta(access);
  return {
    value: courseType,
    label: programTypeLabel(courseType),
    shortLabel: programTypeLabel(courseType),
    description: "",
    accessMode: meta.accessMode,
    accessSummary: meta.accessSummary,
    recognition: DEFAULT_RECOGNITION_BY_TYPE[courseType as AcademyProgramType] ?? "certificate_of_completion",
    pricePrimary: meta.pricePrimary,
    prefersPrerequisite: false,
    defaultAccess: access,
    defaultLearningPath: DEFAULT_LEARNING_PATH_BY_TYPE[courseType as AcademyProgramType],
  };
}

export const ACADEMY_PROGRAM_TYPE_OPTIONS = programTypeOptions();
export const ACADEMY_COURSE_ACCESS_OPTIONS = courseAccessOptions();
export const ACADEMY_COURSE_RECOGNITION_OPTIONS = courseRecognitionOptions();
export const ACADEMY_LEARNING_PATH_OPTIONS = learningPathOptions();

export function programAccessMode(access: AcademyCourseAccess | string): AcademyAccessMode {
  return accessModeFor(access);
}

export function allowsOpenEnrollment(access: AcademyCourseAccess | string): boolean {
  return accessModeFor(access) === "open";
}

export function allowsSelfPurchase(access: AcademyCourseAccess | string): boolean {
  return accessModeFor(access) === "purchase";
}

/** @deprecated Organization assignment no longer blocks self-serve; kept for call-site compatibility. */
export function requiresEntitlementAccess(_access?: AcademyCourseAccess | string): boolean {
  return false;
}
