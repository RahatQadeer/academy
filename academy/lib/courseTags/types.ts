export type CourseTag = {
  /** Stable id = slug of the tag name (stored in category, not a separate table). */
  id: string;
  name: string;
  slug: string;
  isPremade: boolean;
  archivedAt: string | null;
  /** Programs currently using this tag (management screen only). */
  programCount?: number;
};

export type CourseTagListResult =
  | { ok: true; tags: CourseTag[] }
  | { ok: false; reason: "unauthorized" | "failed" };

export type CourseTagMutationResult =
  | { ok: true; tag: CourseTag }
  | { ok: false; reason: "unauthorized" | "invalid" | "failed" | "conflict"; message: string };
