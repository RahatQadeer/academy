export const ENROLLED_PROGRAM_LIMIT = 48;
export const RESOURCE_LIMIT = 200;

export type EnrolledProgramOption = {
  programId: string;
  programName: string;
};

export type LearnerResourceItem = {
  id: string;
  title: string;
  resourceType: string;
  url: string;
  notes: string;
  programId: string;
  programName: string;
  moduleTitle: string;
  lessonTitle: string;
  sortOrder: number;
};

export type ResourceSort = "title" | "type" | "lesson";

export type ResourcesData = {
  enrolledPrograms: EnrolledProgramOption[];
  selectedProgramId: string | null;
  selectedProgramName: string | null;
  truncatedEnrollments: boolean;
  resources: LearnerResourceItem[];
  resourceTypes: string[];
};

export type ResourcesLoadResult = { ok: true; data: ResourcesData } | { ok: false };

export type ResourcesQuery = {
  programId: string | null;
  search: string;
  type: string;
  sort: ResourceSort;
};
