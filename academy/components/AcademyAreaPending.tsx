import { Button } from "@/base/components/Button";
import { PageHeader, PageShell } from "@/academy/components/ui";

export function AcademyAreaPending({ title }: { title: string }) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Private Attaché Academy"
        title={title}
        description="This Academy area is not available yet. Your Dashboard is ready at the Academy home."
      />
      <Button href="/academy" variant="secondary">
        Go to Dashboard
      </Button>
    </PageShell>
  );
}
