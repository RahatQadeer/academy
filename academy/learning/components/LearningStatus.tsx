import type { AcademyEnrollmentStatus } from "@/academy/lib/domain";

export function LearningStatus({
  status,
  progressPercent,
}: {
  status: AcademyEnrollmentStatus;
  progressPercent: number;
}) {
  const label =
    status === "enrolled" && progressPercent === 0
      ? "Not started"
      : `${Math.max(0, Math.min(100, progressPercent))}% complete`;

  return (
    <p className="text-[13px] whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
      {label}
    </p>
  );
}
