"use client";

import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import type { AcademyAdminListItem } from "../types";
import { AdminRoleButton } from "./AdminRoleButton";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M5 3.5L8.5 7L5 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminsTable({
  title,
  admins,
  canRevoke,
}: {
  title?: string;
  admins: AcademyAdminListItem[];
  canRevoke: boolean;
}) {
  return (
    <section>
      <div
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        {title ? (
          <div
            className="flex items-end justify-between gap-3 border-b px-5 py-4 sm:px-6"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="text-[16px] font-semibold tracking-[-0.2px]">{title}</h2>
            <p className="text-[12.5px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
              {admins.length.toLocaleString()}
            </p>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[720px] table-fixed border-collapse text-left text-[13.5px]"
            style={{ color: "var(--ink)" }}
          >
            <caption className="sr-only">{title ?? "Academy admins"}</caption>
            <colgroup>
              <col style={{ width: "48%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr
                className="border-b text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-tertiary)",
                  background: "var(--surface-soft)",
                }}
              >
                <th scope="col" className="px-5 py-3 font-semibold sm:px-6">
                  Admin
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">
                  Access
                </th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {admins.map((item, index) => (
                <tr
                  key={item.userId}
                  className="border-b align-middle transition-colors last:border-b-0 hover:bg-surface-soft"
                  style={{ borderColor: "var(--border)" }}
                >
                  <th scope="row" className="px-5 py-3.5 text-left font-medium sm:px-6">
                    <Link
                      href={`/academy/admin/admins/${item.userId}`}
                      className="flex items-center gap-3 text-ink no-underline transition-colors hover:text-accent"
                    >
                      <Avatar
                        name={item.displayName}
                        size={36}
                        tone={index % 2 === 0 ? "tan" : "blue"}
                      />
                      <span className="min-w-0">
                        <span className="block truncate leading-snug">{item.displayName}</span>
                        {item.email ? (
                          <span
                            className="mt-0.5 block truncate text-[12px] font-normal"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {item.email}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </th>
                  <td className="px-4 py-3.5 text-center">
                    <Pill tone={item.membershipStatus === "active" ? "success" : "warning"}>
                      {item.membershipStatus === "active" ? "Active" : "Suspended"}
                    </Pill>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {item.membershipStatus === "suspended" ? (
                      <AdminRoleButton userId={item.userId} action="reactivate" appearance="row" />
                    ) : canRevoke ? (
                      <AdminRoleButton userId={item.userId} action="revoke" appearance="row" />
                    ) : (
                      <span
                        className="inline-flex items-center rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium"
                        style={{
                          color: "var(--text-tertiary)",
                          background: "var(--surface-soft)",
                          boxShadow: "inset 0 0 0 1px var(--border)",
                        }}
                        title="At least one active Admin is required"
                      >
                        Required
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <Link
                      href={`/academy/admin/admins/${item.userId}`}
                      aria-label={`Open ${item.displayName}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] no-underline transition-colors hover:bg-[color:var(--accent-tint)] hover:text-accent"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <ChevronIcon />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
