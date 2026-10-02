import { Button } from "@/base/components/Button";
import { PageHeader, PageShell } from "@/academy/components/ui";

export function AcademySurfacePending({ surface }: { surface: "instructor" | "admin" }) {
  const isInstructor = surface === "instructor";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Private Attaché Academy"
        title={isInstructor ? "Instructor tools" : "Academy Admin"}
        description={
          isInstructor
            ? "Your Instructor authorization is active, but this page does not exist. Your assigned programs are on the Instructor dashboard."
            : "Your Admin authorization is active, but this page does not exist. Catalog administration is on the Admin dashboard."
        }
      />
      <Button href={isInstructor ? "/academy/instructor" : "/academy/admin"} variant="secondary">
        Back to dashboard
      </Button>
    </PageShell>
  );
}
