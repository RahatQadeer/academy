import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import { Surface } from "@/academy/components/ui";
import { enrollmentStatusLabel } from "@/academy/admin/enrollments/utils/labels";
import { catalogAdminStatusLabel } from "@/academy/admin/lib/programDeletion";
import type { AdminDashboardData } from "../types";

function programStatusTone(status: AdminDashboardData["recentPrograms"][number]["status"]) {
  if (status === "published") return "success" as const;
  if (status === "pending_approval") return "warning" as const;
  return "neutral" as const;
}

function enrollmentStatusTone(status: AdminDashboardData["recentEnrollments"][number]["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "in_progress") return "info" as const;
  return "neutral" as const;
}

function PanelHeader({
  title,
  href,
}: {
  title: string;
  href: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 border-b px-5 py-3.5"
      style={{ borderColor: "var(--border)" }}
    >
      <h2 className="text-[15px] font-semibold tracking-[-0.2px]">{title}</h2>
      <Link
        href={href}
        className="text-[13px] font-medium text-accent no-underline hover:text-accent-hover"
      >
        View all
      </Link>
    </div>
  );
}

export function AdminDashboardActivity({ data }: { data: AdminDashboardData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Surface elevated className="overflow-hidden">
        <PanelHeader title="Recent programs" href="/academy/admin/programs" />
        {data.recentPrograms.length === 0 ? (
          <p className="px-5 py-8 text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
            No programs yet. Create the first one on Programs.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {data.recentPrograms.map((program, index) => (
              <li
                key={program.id}
                style={index > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
              >
                <Link
                  href={`/academy/admin/catalog/${program.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 no-underline transition-colors hover:bg-[var(--surface-soft)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-ink">{program.name}</p>
                    {program.updatedLabel ? (
                      <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        Updated {program.updatedLabel}
                      </p>
                    ) : null}
                  </div>
                  <Pill tone={programStatusTone(program.status)}>
                    {catalogAdminStatusLabel(program.status)}
                  </Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <Surface elevated className="overflow-hidden">
        <PanelHeader title="Recent enrollments" href="/academy/admin/enrollments" />
        {data.recentEnrollments.length === 0 ? (
          <p className="px-5 py-8 text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
            No enrollments yet.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {data.recentEnrollments.map((enrollment, index) => (
              <li
                key={enrollment.id}
                style={index > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
              >
                <Link
                  href={`/academy/admin/enrollments/program/${enrollment.programId}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 no-underline transition-colors hover:bg-[var(--surface-soft)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      name={enrollment.learnerName}
                      size={34}
                      tone={index % 2 === 0 ? "tan" : "blue"}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">{enrollment.learnerName}</p>
                      <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                        {enrollment.programName}
                        {enrollment.enrolledLabel ? ` · ${enrollment.enrolledLabel}` : ""}
                      </p>
                    </div>
                  </div>
                  <Pill tone={enrollmentStatusTone(enrollment.status)}>
                    {enrollmentStatusLabel(enrollment.status)}
                  </Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}
