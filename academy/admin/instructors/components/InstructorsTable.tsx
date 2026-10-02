import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import type { AdminInstructorListItem } from "../types";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";
const VISIBLE_PROGRAMS = 2;

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

function ProgramMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden className="shrink-0">
      <path
        d="M2.25 2.4h5.1c.9 0 1.65.72 1.65 1.6v5.35c0 .55-.45 1-1 1H3.5c-.7 0-1.25-.55-1.25-1.25V2.4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M4.1 4.35h3.4M4.1 6.15h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ProgramChips({ names }: { names: string[] }) {
  if (names.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-medium"
        style={{
          color: "var(--text-tertiary)",
          background: "var(--surface-soft)",
          boxShadow: "inset 0 0 0 1px var(--border)",
        }}
      >
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
          style={{ background: "var(--border)", color: "var(--text-tertiary)" }}
          aria-hidden
        >
          –
        </span>
        Not assigned
      </span>
    );
  }

  const visible = names.slice(0, VISIBLE_PROGRAMS);
  const extra = names.length - visible.length;
  const overflowTitle = extra > 0 ? names.slice(VISIBLE_PROGRAMS).join(", ") : undefined;

  return (
    <div className="flex max-w-[340px] flex-col gap-1.5">
      {visible.map((name, index) => (
        <span
          key={`${name}-${index}`}
          title={name}
          className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12.5px] font-medium leading-snug"
          style={{
            background: "color-mix(in srgb, var(--accent-tint, #e7f1fb) 72%, white)",
            color: "var(--ink)",
            boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent, #2383e2) 14%, var(--border))",
          }}
        >
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]"
            style={{
              background: "color-mix(in srgb, var(--accent, #2383e2) 12%, white)",
              color: "var(--accent)",
            }}
          >
            <ProgramMark />
          </span>
          <span className="min-w-0 truncate">{name}</span>
        </span>
      ))}
      {extra > 0 ? (
        <span
          title={overflowTitle}
          className="inline-flex w-fit items-center gap-1 rounded-[8px] px-2.5 py-1 text-[11.5px] font-semibold tabular-nums"
          style={{
            background: "var(--surface-soft)",
            color: "var(--text-secondary)",
            boxShadow: "inset 0 0 0 1px var(--border)",
          }}
        >
          +{extra} more
        </span>
      ) : null}
    </div>
  );
}

export function InstructorsTable({
  title,
  instructors,
}: {
  title?: string;
  instructors: AdminInstructorListItem[];
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
              {instructors.length.toLocaleString()}
            </p>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[760px] table-fixed border-collapse text-left text-[13.5px]"
            style={{ color: "var(--ink)" }}
          >
            <caption className="sr-only">{title ?? "Academy instructors"}</caption>
            <colgroup>
              <col style={{ width: "32%" }} />
              <col style={{ width: "42%" }} />
              <col style={{ width: "16%" }} />
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
                  Instructor
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Assigned programs
                </th>
                <th scope="col" className="px-4 py-3 text-center font-semibold">
                  Status
                </th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">
                  <span className="sr-only">Manage</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {instructors.map((item, index) => (
                <tr
                  key={item.userId}
                  className="border-b align-middle transition-colors last:border-b-0 hover:bg-surface-soft"
                  style={{ borderColor: "var(--border)" }}
                >
                  <th scope="row" className="px-5 py-3.5 text-left font-medium sm:px-6">
                    <Link
                      href={`/academy/admin/instructors/${item.userId}`}
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
                  <td className="px-4 py-3.5">
                    <ProgramChips names={item.assignedPrograms} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Pill tone={item.membershipStatus === "active" ? "success" : "warning"}>
                      {item.membershipStatus === "active" ? "Active" : "Suspended"}
                    </Pill>
                  </td>
                  <td className="px-3 py-3.5 text-center">
                    <Link
                      href={`/academy/admin/instructors/${item.userId}`}
                      aria-label={`Manage ${item.displayName}`}
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
