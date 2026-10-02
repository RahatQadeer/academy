import { Button } from "@/base/components/Button";
import { PageHeader, PageShell } from "@/academy/components/ui";

export function AcademyAccessDenied({
  area,
}: {
  area?: "instructor" | "admin" | "academy" | "learner";
}) {
  const title =
    area === "instructor"
      ? "Instructor access required"
      : area === "admin"
        ? "Admin access required"
        : area === "learner"
          ? "Learner access required"
          : "Academy access required";
  const body =
    area === "instructor"
      ? "This area is limited to assigned Academy Instructors. Learner and workspace roles cannot open it."
      : area === "admin"
        ? "This area is limited to Academy Admins. Ask a Private Attaché administrator if you need access."
        : area === "learner"
          ? "New Academy accounts start as Learners and complete a short onboarding. Instructor and Admin are separate roles on this email — they do not unlock the learner area. To change roles, remove the current Academy role first (or use a different email), then grant the new one."
          : "An active Academy entitlement is required. Existing Academy memberships are not removed when access expires.";

  return (
    <PageShell>
      <PageHeader eyebrow="Private Attaché Academy" title={title} description={body} />
      <Button href="/academy" variant="secondary">
        Back to Academy
      </Button>
    </PageShell>
  );
}
