"use client";

import { useState } from "react";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import { PaginationBar } from "@/academy/components/ui/PaginationBar";
import { formatInstructorDate } from "@/academy/instructor/utils/labels";
import type { ProgramEnrollmentListItem } from "../types";
import { enrollmentStatusLabel } from "../utils/labels";
import { EnrollmentProgressRing } from "./EnrollmentProgressRing";

const PAGE_SIZE = 8;

function statusTone(status: ProgramEnrollmentListItem["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "in_progress") return "info" as const;
  return "neutral" as const;
}

export function ProgramEnrollmentList({
  items,
  truncated = false,
}: {
  items: ProgramEnrollmentListItem[];
  truncated?: boolean;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rangeStart = items.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, items.length);
  const paged = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showPager = pageCount > 1;

  function goToPage(nextPage: number) {
    setPage(nextPage);
    document.getElementById("admin-program-learners")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section id="admin-program-learners" aria-labelledby="program-learners-heading">
      <div
        className="overflow-hidden rounded-[10px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <h2
              id="program-learners-heading"
              className="text-[16px] font-semibold tracking-[-0.2px]"
            >
              Learners
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Progress and status for learners in this program.
            </p>
          </div>
          <p
            className="shrink-0 pt-0.5 text-[12.5px] font-medium tabular-nums"
            style={{ color: "var(--text-tertiary)" }}
          >
            {items.length.toLocaleString()} learner{items.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="min-w-0 overflow-x-hidden">
          <table
            className="w-full table-fixed border-collapse text-left text-[13.5px]"
            style={{ color: "var(--ink)" }}
          >
            <caption className="sr-only">Learners enrolled in this program.</caption>
            <colgroup>
              <col style={{ width: "40%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "18%" }} />
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
                  Learner
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Progress
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Enrolled
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((item, index) => (
                <tr
                  key={item.enrollmentId}
                  className="border-b align-middle last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <th scope="row" className="px-5 py-3.5 text-left font-medium sm:px-6">
                    <div className="flex min-w-0 items-center gap-3 text-ink">
                      <Avatar
                        name={item.displayName}
                        size={34}
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
                    </div>
                  </th>
                  <td className="px-4 py-3.5">
                    <Pill tone={statusTone(item.status)}>
                      {enrollmentStatusLabel(item.status)}
                    </Pill>
                  </td>
                  <td className="px-4 py-3.5">
                    <EnrollmentProgressRing
                      value={item.progressPercent}
                      complete={item.status === "completed"}
                    />
                  </td>
                  <td className="px-4 py-3.5" style={{ color: "var(--text-tertiary)" }}>
                    <span className="block truncate">{formatInstructorDate(item.enrolledAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showPager ? (
          <div
            className="flex max-w-full justify-end border-t px-5 py-5 sm:px-6"
            style={{
              borderColor: "var(--border)",
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--accent-tint-soft) 90%, white) 0%, var(--surface) 100%)",
            }}
          >
            <div
              className="inline-flex max-w-full min-w-0 items-center rounded-[16px] border bg-surface px-2.5 py-2"
              style={{
                borderColor: "var(--border)",
                boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 10px 28px rgba(15,15,15,.06)",
              }}
            >
              <PaginationBar
                page={currentPage}
                pageCount={pageCount}
                total={items.length}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                showRange={false}
                label="Learner pages"
                onPageChange={goToPage}
              />
            </div>
          </div>
        ) : null}
      </div>

      {truncated ? (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Showing the {items.length.toLocaleString()} most recent enrollments.
        </p>
      ) : null}
    </section>
  );
}
