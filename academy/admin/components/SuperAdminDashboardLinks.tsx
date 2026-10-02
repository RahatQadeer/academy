import Link from "next/link";
import { Surface } from "@/academy/components/ui";
import type { AdminDashboardData } from "../types";

type LinkItem = {
  href: string;
  label: string;
  detail: string;
};

/**
 * Super Admin shortcuts — people and platform management only.
 */
export function SuperAdminDashboardLinks({ data }: { data: AdminDashboardData }) {
  const items: LinkItem[] = [
    {
      href: "/academy/admin/users",
      label: "Users",
      detail: "All accounts — suspend or soft-delete",
    },
    {
      href: "/academy/admin/instructors",
      label: "Instructors",
      detail: `${data.instructorCount.toLocaleString()} active — grant or revoke access`,
    },
    {
      href: "/academy/admin/admins",
      label: "Admins",
      detail: `${data.adminCount.toLocaleString()} active — grant or revoke Admin`,
    },
    {
      href: "/academy/admin/enrollments",
      label: "Learners",
      detail: `${data.learnerCount.toLocaleString()} active learner memberships`,
    },
    {
      href: "/academy/admin/audit",
      label: "Activity log",
      detail: "Who changed users, roles, and settings",
    },
  ];

  return (
    <Surface elevated className="overflow-hidden">
      <div
        className="border-b px-5 py-3.5"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className="text-[15px] font-semibold tracking-[-0.2px]">People & access</h2>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Super Admin manages users, Instructors, and Admins. Academy Admins run the catalog and
          publish queue.
        </p>
      </div>
      <ul className="m-0 grid list-none gap-0 p-0 sm:grid-cols-2">
        {items.map((item, index) => (
          <li
            key={item.href}
            style={{
              borderTop: index >= 2 ? "1px solid var(--border)" : undefined,
              borderLeft: index % 2 === 1 ? "1px solid var(--border)" : undefined,
            }}
          >
            <Link
              href={item.href}
              className="flex flex-col gap-0.5 px-5 py-4 no-underline transition-colors hover:bg-[var(--surface-soft)]"
            >
              <span className="text-[14px] font-medium text-ink">{item.label}</span>
              <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                {item.detail}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
