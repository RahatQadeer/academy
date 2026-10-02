"use client";

import { useState } from "react";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import { EditMemberModal } from "@/partner-center/team/components/EditMemberModal";
import { accessLabel, functionLabel } from "@/partner-center/team/lib/labels";
import type { TeamMemberRow, TeamPageData } from "@/partner-center/team/types";

function functionTone(value: string): "accent" | "neutral" {
  return value === "company_admin" ? "accent" : "neutral";
}

export function TeamMembersTable({ data }: { data: TeamPageData }) {
  const [editing, setEditing] = useState<TeamMemberRow | null>(null);

  if (data.members.length === 0) {
    return (
      <div
        className="pa-partner-card mt-4 px-5 py-8 text-center text-[13.5px]"
        style={{ color: "var(--text-secondary)" }}
      >
        No team members yet.
      </div>
    );
  }

  return (
    <>
      <div className="pa-partner-card mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-soft)",
              }}
            >
              {["Name", "Role", "Contact function", "Access", ""].map((heading) => (
                <th
                  key={heading || "actions"}
                  className="px-5 py-3 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.members.map((member) => {
              const displayName = member.salutation
                ? `${member.salutation} ${member.name}`
                : member.name;
              return (
                <tr
                  key={member.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                  className="last:border-b-0"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} size={36} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className="truncate text-[14px] font-medium"
                            style={{ color: "var(--ink)" }}
                          >
                            {displayName}
                          </div>
                          {member.isPrimary ? (
                            <Pill tone="accent">Primary</Pill>
                          ) : null}
                        </div>
                        <div
                          className="truncate text-[12.5px]"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {member.email}
                        </div>
                        {member.phone ? (
                          <div
                            className="truncate text-[12.5px]"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {member.phone}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[13.5px]" style={{ color: "var(--ink)" }}>
                    {member.roleTitle}
                  </td>
                  <td className="px-5 py-3.5">
                    <Pill tone={functionTone(String(member.function))}>
                      {functionLabel(String(member.function))}
                    </Pill>
                  </td>
                  <td className="px-5 py-3.5 text-[13.5px]" style={{ color: "var(--ink)" }}>
                    {accessLabel(member.accessLevel)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {data.canManage ? (
                      <button
                        type="button"
                        className="border-0 bg-transparent p-0 text-[13.5px] font-medium"
                        style={{ color: "var(--accent)", cursor: "pointer" }}
                        onClick={() => setEditing(member)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing ? (
        <EditMemberModal member={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
