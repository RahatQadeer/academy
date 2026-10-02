import type {
  AcademyCourseAccess,
  AcademyCourseRecognition,
  AcademyEnrollmentStatus,
  AcademyLearningPath,
  AcademyProgramType,
} from "@/academy/lib/domain";

export type ExploreAccessFilter = AcademyCourseAccess | "";
export type ExploreSort = "sequence" | "asc" | "desc";
/** Certificate classification filter — same options as program settings. */
export type ExploreRecognitionFilter =
  | "certificate_of_completion"
  | "specialty_endorsement"
  | "professional_certification"
  | "";

export type ExploreCatalogQuery = {
  q: string;
  /** @deprecated Prefer `recognition`. Kept for legacy URLs. */
  type: AcademyProgramType | "";
  recognition: ExploreRecognitionFilter;
  access: ExploreAccessFilter;
  /** @deprecated Prefer `access`. Kept for URL backward compatibility. */
  price: "free" | "paid" | "";
  sort: ExploreSort;
  page?: number;
};

export type ProgramAccessKind =
  | "available"
  | "enrolled"
  | "in_progress"
  | "completed"
  | "purchase"
  | "prerequisite_blocked"
  | "access_required";

export type ProgramAccessState = {
  kind: ProgramAccessKind;
  label: string;
  href: string | null;
  muted: boolean;
  /** Short learner-facing chip (Assigned, Included, Free, …). */
  badge?: string | null;
};

export type ExploreRelatedProgram = {
  id: string;
  name: string;
  type: AcademyProgramType;
};

export type ExploreProgramCard = {
  id: string;
  name: string;
  type: AcademyProgramType;
  accessMode: AcademyCourseAccess;
  recognition: AcademyCourseRecognition;
  learningPath: AcademyLearningPath;
  category: string | null;
  description: string | null;
  coverImageUrl: string | null;
  price: number | null;
  createdAt: string | null;
  prerequisiteProgramId: string | null;
  prerequisiteName: string | null;
  enrollmentStatus: AcademyEnrollmentStatus | null;
  access: ProgramAccessState;
  moduleCount: number;
  skillsGained: string[];
};

export type ExploreCatalogData = {
  programs: ExploreProgramCard[];
  query: ExploreCatalogQuery;
  truncated: boolean;
};

export type ExploreCatalogResult =
  | { ok: true; data: ExploreCatalogData }
  | { ok: false };

export type ExploreModuleOutline = {
  id: string;
  title: string;
  sortOrder: number;
};

export type ExploreProgramDetail = {
  id: string;
  name: string;
  type: AcademyProgramType;
  accessMode: AcademyCourseAccess;
  recognition: AcademyCourseRecognition;
  learningPath: AcademyLearningPath;
  category: string | null;
  description: string | null;
  coverImageUrl: string | null;
  price: number | null;
  prerequisiteProgramId: string | null;
  prerequisiteName: string | null;
  enrollmentStatus: AcademyEnrollmentStatus | null;
  progressPercent: number | null;
  contentUnlocked: boolean;
  moduleCount: number;
  access: ProgramAccessState;
  modules: ExploreModuleOutline[];
  nextCourses: ExploreRelatedProgram[];
  relatedCourses: ExploreRelatedProgram[];
};

export type ExploreProgramDetailResult =
  | { ok: true; data: ExploreProgramDetail }
  | { ok: true; data: null }
  | { ok: false };
