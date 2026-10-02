import type { AcademyProgramType } from "@/academy/lib/domain";
import type { AcademyInterestId } from "@/academy/onboarding/lib/interests";

export const INTEREST_PROGRAM_TYPES: Record<AcademyInterestId, AcademyProgramType[]> = {
  certification: ["certification_program"],
  practice: ["course"],
  specialty: ["endorsement_program"],
  coordination: ["short_course", "course"],
  "short-courses": ["short_course", "course"],
  exploring: [],
};

const TYPE_FALLBACK_RANK: AcademyProgramType[] = [
  "certification_program",
  "short_course",
  "course",
  "endorsement_program",
];

function typeFallbackRank(type: AcademyProgramType) {
  const index = TYPE_FALLBACK_RANK.indexOf(type);
  return index === -1 ? TYPE_FALLBACK_RANK.length : index;
}

export function interestMatchScore(type: AcademyProgramType, interestIds: AcademyInterestId[]) {
  const focused = interestIds.filter((id) => id !== "exploring");
  if (!focused.length) return 0;
  return focused.some((id) => INTEREST_PROGRAM_TYPES[id]?.includes(type)) ? 1 : 0;
}

export function rankRecommendedPrograms<T extends { type: AcademyProgramType; name: string }>(
  programs: T[],
  interestIds: AcademyInterestId[],
  limit = 3,
): T[] {
  return [...programs]
    .sort((a, b) => {
      const score = interestMatchScore(b.type, interestIds) - interestMatchScore(a.type, interestIds);
      if (score !== 0) return score;
      const rank = typeFallbackRank(a.type) - typeFallbackRank(b.type);
      if (rank !== 0) return rank;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function recommendedAction(
  type: AcademyProgramType,
): "view" | "start" {
  if (type === "short_course" || type === "course") return "start";
  return "view";
}
