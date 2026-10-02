import Link from "next/link";
import { PageHeader, PageShell } from "@/academy/components/ui";

export function InstructorComingSoon({ title }: { title: string }) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Instructor"
        title={title}
        description="This Instructor tool is not available yet. Your assigned programs remain on the Instructor dashboard."
      />
      <Link
        href="/academy/instructor"
        className="text-[13.5px] font-medium text-accent no-underline transition-colors hover:text-accent-hover"
      >
        ← Back to Instructor dashboard
      </Link>
    </PageShell>
  );
}
