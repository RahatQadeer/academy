/** Course topic tags — reuse academy_programs.category (no new tables). */

/** Programs require exactly this many tags (min === max). */
export const COURSE_TAG_MIN = 3;
export const COURSE_TAG_MAX = 3;
export const COURSE_TAG_NAME_MAX = 64;

export const PREMADE_COURSE_TAG_NAMES = [
  "AI",
  "Art & Collections",
  "Automation",
  "Aviation",
  "Client Experience",
  "Communication",
  "Education & Training",
  "Entrepreneurship",
  "Events",
  "Executive Support",
  "Family Office",
  "Finance",
  "Healthcare",
  "Hospitality",
  "Household Staffing",
  "International Living",
  "Leadership & Management",
  "Marine & Yachting",
  "Marketing",
  "Negotiation",
  "Operations",
  "Planning & Projects",
  "Pricing",
  "Privacy & Security",
  "Productivity",
  "Professional Growth",
  "Real Estate",
  "Relocation",
  "Research",
  "Residence Operations",
  "Risk & Compliance",
  "Sales",
  "Strategy & Decisions",
  "Travel",
] as const;

export function slugifyCourseTag(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeCourseTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, COURSE_TAG_NAME_MAX);
}

export function validateProgramTagIds(tagIds: string[]): string | null {
  const unique = [...new Set(tagIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length < COURSE_TAG_MIN) {
    const remaining = COURSE_TAG_MIN - unique.length;
    if (COURSE_TAG_MIN === COURSE_TAG_MAX) {
      return remaining === COURSE_TAG_MIN
        ? `Select ${COURSE_TAG_MIN} course tags.`
        : `Select ${remaining} more tag${remaining === 1 ? "" : "s"} (${unique.length}/${COURSE_TAG_MAX}).`;
    }
    return `Select at least ${COURSE_TAG_MIN} course tags.`;
  }
  if (unique.length > COURSE_TAG_MAX) {
    return `Select at most ${COURSE_TAG_MAX} course tags.`;
  }
  return null;
}

/** Encode selected tag names into the existing category text column. */
export function encodeProgramCategory(names: string[]): string {
  return names
    .map((name) => normalizeCourseTagName(name))
    .filter(Boolean)
    .slice(0, COURSE_TAG_MAX)
    .join(", ");
}

/** Parse category text back into ordered tag names (JSON array or comma-separated). */
export function parseProgramCategory(category: string | null | undefined): string[] {
  const raw = (category ?? "").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? normalizeCourseTagName(item) : ""))
          .filter(Boolean)
          .slice(0, COURSE_TAG_MAX);
      }
    } catch {
      /* fall through */
    }
  }
  return raw
    .split(",")
    .map((part) => normalizeCourseTagName(part))
    .filter(Boolean)
    .slice(0, COURSE_TAG_MAX);
}

export function premadeTagId(name: string): string {
  return slugifyCourseTag(name);
}

/** Client-safe premade bank — always available even if the server bank fails to load. */
export function listPremadeCourseTags(): {
  id: string;
  name: string;
  slug: string;
  isPremade: true;
  archivedAt: null;
}[] {
  return PREMADE_COURSE_TAG_NAMES.map((name) => {
    const slug = slugifyCourseTag(name);
    return {
      id: slug,
      name,
      slug,
      isPremade: true as const,
      archivedAt: null,
    };
  });
}
