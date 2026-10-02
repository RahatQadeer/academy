import type { AcademyCredentialStatus, AcademyEnrollmentStatus } from "@/academy/lib/domain";
import { lessonPlayerHref } from "@/academy/lesson-player/utils/curriculum";
import type { LearningItem, LearningItemAction } from "../types";

export const MY_LEARNING_LIMIT = 48;

const STATUS_RANK: Record<AcademyEnrollmentStatus, number> = {
  in_progress: 0,
  enrolled: 1,
  completed: 2,
};

export function learningAction(
  status: AcademyEnrollmentStatus,
  programId: string,
  progressPercent: number,
  credential?: { id: string; status: AcademyCredentialStatus } | null,
  available = true,
): LearningItemAction {
  if (!available) {
    if (credential?.status === "awarded" && credential.id) {
      return {
        label: "View certificate",
        href: `/academy/credentials/${credential.id}`,
        variant: "secondary",
      };
    }
    return {
      label: "Not available",
      href: "/academy/learning",
      variant: "muted",
    };
  }
  const href = lessonPlayerHref(programId);
  if (status === "completed") {
    if (credential?.status === "awarded" && credential.id) {
      return {
        label: "View certificate",
        href: `/academy/credentials/${credential.id}`,
        variant: "secondary",
      };
    }
    if (credential?.id) {
      return {
        label:
          credential.status === "credential_review"
            ? "Under review"
            : "View credential",
        href: `/academy/credentials/${credential.id}`,
        variant: "secondary",
      };
    }
    return {
      label: "Certificate pending",
      href: "/academy/credentials",
      variant: "muted",
    };
  }
  if (status === "in_progress" || (status === "enrolled" && progressPercent > 0)) {
    return { label: "Resume", href, variant: "primary" };
  }
  return { label: "Start learning", href, variant: "primary" };
}

export function sortLearningItems(items: LearningItem[]): LearningItem[] {
  return [...items].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    if (a.status === "completed") {
      const aDate = a.completedAt ?? a.enrolledAt;
      const bDate = b.completedAt ?? b.enrolledAt;
      return bDate.localeCompare(aDate);
    }
    return b.enrolledAt.localeCompare(a.enrolledAt);
  });
}

export function formatLearningDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
