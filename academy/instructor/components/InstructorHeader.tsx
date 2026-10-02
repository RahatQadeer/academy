import type { ReactNode } from "react";
import { Button } from "@/base/components/Button";
import { PageHeader } from "@/academy/components/ui";

function InstructorBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]"
      style={{
        background: "var(--accent-tint)",
        color: "var(--accent)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)",
      }}
    >
      Instructor
    </span>
  );
}

export function InstructorHeader({
  title = "Dashboard",
  description,
  actions,
  eyebrow,
}: {
  title?: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2.5">
          <InstructorBadge />
          {actions}
        </div>
      }
      className="mb-7"
    />
  );
}

export function InstructorDashboardHeader({ displayName }: { displayName: string }) {
  const name = displayName.trim().split(/\s+/)[0] ?? "";
  return (
    <InstructorHeader
      title="Dashboard"
      description={
        name
          ? `Welcome back, ${name}. Edit assigned programs. Publishing still needs admin approval.`
          : "Edit assigned programs. Publishing still needs admin approval."
      }
      actions={
        <Button href="/academy/instructor/programs/new" variant="primary">
          New program
        </Button>
      }
    />
  );
}
