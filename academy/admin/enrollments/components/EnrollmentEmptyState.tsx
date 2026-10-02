import { EmptyState } from "@/academy/components/ui";

function EnrollmentsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4 19c.5-3.1 2.5-4.8 5-4.8s4.5 1.7 5 4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M15.4 19c.3-1.8 1.2-3 2.4-3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EnrollmentEmptyState({ kind }: { kind: "enrollments" | "programs" | "program" }) {
  const title =
    kind === "programs"
      ? "No program breakdown"
      : kind === "program"
        ? "No learners enrolled"
        : "No enrollments yet";
  const body =
    kind === "programs"
      ? "Enrollment records could not be grouped into programs."
      : kind === "program"
        ? "When learners enroll in this program, they will appear here with status and progress."
        : "Totals appear here after learners enroll in an Academy program.";

  return <EmptyState icon={<EnrollmentsIcon />} title={title} body={body} />;
}
