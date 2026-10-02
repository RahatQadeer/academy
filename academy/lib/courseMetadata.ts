import {
  ACADEMY_COURSE_ACCESS,
  ACADEMY_CREDENTIAL_VALIDITIES,
  ACADEMY_LEARNING_PATHS,
  ACADEMY_PROGRAM_TYPES,
  isAcademyCourseAccess,
  isAcademyCourseRecognition,
  isAcademyCredentialValidity,
  isAcademyLearningPath,
  isAcademyProgramType,
  type AcademyCourseAccess,
  type AcademyCourseRecognition,
  type AcademyCredentialType,
  type AcademyCredentialValidity,
  type AcademyLearningPath,
  type AcademyProgramType,
} from "./domain";

/**
 * Certificate classification shown in program settings + learner Explore.
 * (Not Free/Paid — that is Pricing. Not Short Course / Course — that Type control is removed.)
 */
export const CERTIFICATE_CLASS_VALUES = [
  "certificate_of_completion",
  "specialty_endorsement",
  "professional_certification",
] as const;

export type CertificateClass = (typeof CERTIFICATE_CLASS_VALUES)[number];

export function isCertificateClass(value: string): value is CertificateClass {
  return (CERTIFICATE_CLASS_VALUES as readonly string[]).includes(value);
}

/** Keep DB `type` aligned when authors pick a certificate class. */
export function programTypeForRecognition(
  recognition: AcademyCourseRecognition,
  currentType?: AcademyProgramType | null,
): AcademyProgramType {
  if (recognition === "professional_certification") return "certification_program";
  if (recognition === "specialty_endorsement") return "endorsement_program";
  if (currentType === "short_course") return "short_course";
  return "course";
}

/** Valid recognition values for each course type (legacy + certificate classes). */
export const RECOGNITION_BY_TYPE: Record<AcademyProgramType, readonly AcademyCourseRecognition[]> = {
  short_course: ["none", "certificate_of_completion", "specialty_endorsement", "professional_certification"],
  course: ["none", "certificate_of_completion", "specialty_endorsement", "professional_certification"],
  certification_program: ["professional_certification", "certificate_of_completion", "specialty_endorsement"],
  endorsement_program: ["specialty_endorsement", "certificate_of_completion", "professional_certification"],
};

export const DEFAULT_RECOGNITION_BY_TYPE: Record<AcademyProgramType, AcademyCourseRecognition> = {
  short_course: "certificate_of_completion",
  course: "certificate_of_completion",
  certification_program: "professional_certification",
  endorsement_program: "specialty_endorsement",
};

export const DEFAULT_ACCESS_BY_TYPE: Record<AcademyProgramType, AcademyCourseAccess> = {
  short_course: "free",
  course: "free",
  certification_program: "purchased",
  endorsement_program: "purchased",
};

export const DEFAULT_LEARNING_PATH_BY_TYPE: Record<AcademyProgramType, AcademyLearningPath> = {
  short_course: "whitby",
  course: "business_and_practice",
  certification_program: "certification",
  endorsement_program: "specialty",
};

/** Default certificate term — CPA-style recognition gets 3 years. */
export const DEFAULT_VALIDITY_BY_RECOGNITION: Record<
  AcademyCourseRecognition,
  AcademyCredentialValidity
> = {
  none: "none",
  certificate_of_completion: "none",
  professional_certification: "three_years",
  specialty_endorsement: "none",
};

export const DEFAULT_VALIDITY_BY_TYPE: Record<AcademyProgramType, AcademyCredentialValidity> = {
  short_course: "none",
  course: "none",
  certification_program: "three_years",
  endorsement_program: "none",
};

export type CourseMetadataDefaults = {
  type: AcademyProgramType;
  access: AcademyCourseAccess;
  recognition: AcademyCourseRecognition;
  learningPath: AcademyLearningPath;
};

/** Map old CourseGen / catalog type strings onto the new metadata model. */
export function mapLegacyProgramType(raw: string): CourseMetadataDefaults | null {
  const key = raw.trim();
  const lower = key.toLowerCase();

  if (isAcademyProgramType(lower)) {
    return {
      type: lower,
      access: DEFAULT_ACCESS_BY_TYPE[lower],
      recognition: DEFAULT_RECOGNITION_BY_TYPE[lower],
      learningPath: DEFAULT_LEARNING_PATH_BY_TYPE[lower],
    };
  }

  const table: Record<string, CourseMetadataDefaults> = {
    cpa: {
      type: "certification_program",
      access: "purchased",
      recognition: "professional_certification",
      learningPath: "certification",
    },
    certified_private_attache: {
      type: "certification_program",
      access: "purchased",
      recognition: "professional_certification",
      learningPath: "certification",
    },
    "certified private attaché": {
      type: "certification_program",
      access: "purchased",
      recognition: "professional_certification",
      learningPath: "certification",
    },
    professional_practice_accelerator: {
      type: "course",
      access: "professional_plus",
      recognition: "certificate_of_completion",
      learningPath: "business_and_practice",
    },
    "professional practice accelerator": {
      type: "course",
      access: "professional_plus",
      recognition: "certificate_of_completion",
      learningPath: "business_and_practice",
    },
    specialty_endorsement: {
      type: "endorsement_program",
      access: "purchased",
      recognition: "specialty_endorsement",
      learningPath: "specialty",
    },
    "specialty endorsement": {
      type: "endorsement_program",
      access: "purchased",
      recognition: "specialty_endorsement",
      learningPath: "specialty",
    },
    intelligent_coordination: {
      type: "short_course",
      access: "free",
      recognition: "certificate_of_completion",
      learningPath: "whitby",
    },
    "intelligent coordination": {
      type: "short_course",
      access: "free",
      recognition: "certificate_of_completion",
      learningPath: "whitby",
    },
    free_course: {
      type: "course",
      access: "free",
      recognition: "certificate_of_completion",
      learningPath: "business_and_practice",
    },
    "free course": {
      type: "course",
      access: "free",
      recognition: "certificate_of_completion",
      learningPath: "business_and_practice",
    },
    paid_course: {
      type: "course",
      access: "purchased",
      recognition: "certificate_of_completion",
      learningPath: "business_and_practice",
    },
    "paid course": {
      type: "course",
      access: "purchased",
      recognition: "certificate_of_completion",
      learningPath: "business_and_practice",
    },
  };

  return table[lower] ?? table[key] ?? null;
}

export function normalizeLegacyProgramType(raw: string): AcademyProgramType {
  return mapLegacyProgramType(raw)?.type ?? "course";
}

/**
 * Final gate before any DB write to `academy_programs.type`.
 * Never returns legacy CourseGen values (paid_course, cpa, …).
 */
export function toDbProgramType(raw: string | null | undefined): AcademyProgramType {
  const normalized = normalizeLegacyProgramType(String(raw ?? "course"));
  return isAcademyProgramType(normalized) ? normalized : "course";
}

export function isRecognitionAllowedForType(
  _type: AcademyProgramType,
  recognition: AcademyCourseRecognition,
): boolean {
  // Certificate class is set independently in settings; type is derived from it.
  return isAcademyCourseRecognition(recognition);
}

export function coerceRecognitionForType(
  type: AcademyProgramType,
  recognition: string | null | undefined,
): AcademyCourseRecognition {
  if (recognition && isAcademyCourseRecognition(recognition)) return recognition;
  return DEFAULT_RECOGNITION_BY_TYPE[type];
}

export function coerceAccess(value: string | null | undefined, type: AcademyProgramType): AcademyCourseAccess {
  if (value && isAcademyCourseAccess(value)) return value;
  return DEFAULT_ACCESS_BY_TYPE[type];
}

export function coerceLearningPath(
  value: string | null | undefined,
  type: AcademyProgramType,
): AcademyLearningPath {
  if (value && isAcademyLearningPath(value)) return value;
  return DEFAULT_LEARNING_PATH_BY_TYPE[type];
}

export function coerceCredentialValidity(
  value: string | null | undefined,
  type: AcademyProgramType,
  recognition?: AcademyCourseRecognition | string | null,
): AcademyCredentialValidity {
  if (value && isAcademyCredentialValidity(value)) return value;
  if (recognition && isAcademyCourseRecognition(recognition)) {
    return DEFAULT_VALIDITY_BY_RECOGNITION[recognition];
  }
  return DEFAULT_VALIDITY_BY_TYPE[type];
}

export function credentialTypeForRecognition(
  recognition: AcademyCourseRecognition,
): AcademyCredentialType | null {
  if (recognition === "none") return null;
  if (recognition === "professional_certification") return "cpa_credential";
  if (recognition === "specialty_endorsement") return "specialty_endorsement";
  return "certificate_of_completion";
}

/** Prefer recognition; fall back to program type for endorsement / certification. */
export function credentialTypeForProgram(
  recognition: AcademyCourseRecognition | string | null | undefined,
  type: AcademyProgramType | string | null | undefined,
): AcademyCredentialType {
  if (recognition && isAcademyCourseRecognition(recognition)) {
    const fromRecognition = credentialTypeForRecognition(recognition);
    if (fromRecognition) return fromRecognition;
  }
  const normalized = type ? normalizeLegacyProgramType(String(type)) : "course";
  if (normalized === "endorsement_program") return "specialty_endorsement";
  if (normalized === "certification_program") return "cpa_credential";
  return "certificate_of_completion";
}

export function programTypeOptions(): { value: AcademyProgramType; label: string }[] {
  return ACADEMY_PROGRAM_TYPES.map((value) => ({
    value,
    label:
      value === "short_course"
        ? "Short Course"
        : value === "course"
          ? "Course"
          : value === "certification_program"
            ? "Certification Program"
            : "Specialty Endorsement",
  }));
}

export function courseAccessOptions(): { value: AcademyCourseAccess; label: string }[] {
  return ACADEMY_COURSE_ACCESS.map((value) => ({
    value,
    label:
      value === "free"
        ? "Free"
        : value === "standard_plus"
          ? "Standard+"
          : value === "professional_plus"
            ? "Professional+"
            : value === "teams_plus"
              ? "Teams+"
              : value === "purchased"
                ? "Purchased"
                : "Organization Assigned",
  }));
}

/** Settings UI: only Free or Paid (maps to access `free` | `purchased`). Not program Type. */
export type PricingAccess = "free" | "purchased";

export function pricingAccessOptions(): { value: PricingAccess; label: string }[] {
  return [
    { value: "free", label: "Free" },
    { value: "purchased", label: "Paid" },
  ];
}

/** Collapse legacy plan tiers / org-assigned into Free for the binary Pricing control. */
export function toPricingAccess(access: string | null | undefined): PricingAccess {
  return access === "purchased" ? "purchased" : "free";
}

export function isPaidAccess(access: string | null | undefined): boolean {
  return toPricingAccess(access) === "purchased";
}

/** Certificate classification options for settings + Explore (no Type, no “None”). */
export function courseRecognitionOptions(
  _type?: AcademyProgramType,
): { value: AcademyCourseRecognition; label: string }[] {
  return CERTIFICATE_CLASS_VALUES.map((value) => ({
    value,
    label:
      value === "certificate_of_completion"
        ? "Certificate of Completion"
        : value === "professional_certification"
          ? "Professional Credential"
          : "Specialty Endorsement",
  }));
}

export function learningPathOptions(): { value: AcademyLearningPath; label: string }[] {
  return ACADEMY_LEARNING_PATHS.map((value) => ({
    value,
    label:
      value === "whitby"
        ? "Whitby"
        : value === "business_and_practice"
          ? "Business & Practice"
          : value === "specialty"
            ? "Specialty"
            : value === "certification"
              ? "Certification"
              : "Organization Training",
  }));
}

export function credentialValidityOptions(): {
  value: AcademyCredentialValidity;
  label: string;
}[] {
  return ACADEMY_CREDENTIAL_VALIDITIES.map((value) => ({
    value,
    label: value === "none" ? "Does not expire" : "3 years",
  }));
}
