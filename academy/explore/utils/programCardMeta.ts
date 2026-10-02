import type { AcademyCourseRecognition, AcademyProgramType } from "@/academy/lib/domain";
import { courseRecognitionLabel, programTypeLabel } from "@/academy/lib/domain";

export type ProgramCardProvider = "whitby" | "academy";

const LEVEL_BY_TYPE: Record<AcademyProgramType, string> = {
  certification_program: "Advanced",
  endorsement_program: "Advanced",
  course: "Intermediate",
  short_course: "Beginner",
};

export function programCardProvider(type: AcademyProgramType): ProgramCardProvider {
  // Learner Explore shows Academy branding — avoid Whitby ribbon on every card.
  void type;
  return "academy";
}

export function programCardProviderLabel(provider: ProgramCardProvider): string {
  return provider === "whitby" ? "Whitby" : "Academy";
}

export function programCardLevel(type: AcademyProgramType): string {
  return LEVEL_BY_TYPE[type] ?? "Intermediate";
}

export function programCardProductKind(
  type: AcademyProgramType,
  recognition?: AcademyCourseRecognition,
): string {
  if (recognition) return courseRecognitionLabel(recognition);
  if (type === "certification_program") return "Professional Certification";
  if (type === "endorsement_program") return "Specialty Endorsement";
  return "Certificate of Completion";
}

export function programCardDuration(moduleCount: number): string {
  if (moduleCount <= 0) return "Flexible pace";
  if (moduleCount <= 3) return "1–2 weeks";
  if (moduleCount <= 8) return "2–4 weeks";
  return "1–3 months";
}

export function programCardTypeLabel(type: AcademyProgramType): string {
  return programTypeLabel(type);
}
