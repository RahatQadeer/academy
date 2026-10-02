"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { PaginationBar } from "@/academy/components/ui/PaginationBar";
import { programTypeLabel } from "@/academy/lib/domain";
import { programStatusLabel } from "@/academy/instructor/utils/labels";
import type { AdminEnrollmentsData, ProgramEnrollmentRow } from "../types";
import { EnrollmentEmptyState } from "./EnrollmentEmptyState";

const PAGE_SIZE = 8;
const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

function statusTone(status: ProgramEnrollmentRow["programStatus"]) {
  if (status === "published") return "success" as const;
  if (status === "pending_approval") return "warning" as const;
  return "neutral" as const;
}

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

export function ProgramEnrollmentTable({ data }: { data: AdminEnrollmentsData }) {
  const [page, setPage] = useState(1);

  if (data.programs.length === 0) {
    return <EnrollmentEmptyState kind={data.kpis.total === 0 ? "enrollments" : "programs"} />;
  }

  const pageCount = Math.max(1, Math.ceil(data.programs.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rangeStart = (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, data.programs.length);
  const paged = data.programs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showPager = pageCount > 1;

  function goToPage(nextPage: number) {
    setPage(nextPage);
    document.getElementById("admin-learners-results")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section id="admin-learners-results" aria-labelledby="enrollments-by-program-heading">
      <div
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        <div
          className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <h2
              id="enrollments-by-program-heading"
              className="text-[16px] font-semibold tracking-[-0.2px]"
            >
              By program
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Open a program to inspect individual enrollments. This page is inspection only.
            </p>
          </div>
          <p
            className="shrink-0 pt-0.5 text-[12.5px] font-medium tabular-nums"
            style={{ color: "var(--text-tertiary)" }}
          >
            {data.programs.length.toLocaleString()} program{data.programs.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="min-w-0 overflow-x-hidden">
          <table
            className="w-full table-fixed border-collapse text-left text-[13.5px]"
            style={{ color: "var(--ink)" }}
          >
            <caption className="sr-only">Enrollment totals grouped by Academy program.</caption>
            <colgroup>
              <col style={{ width: "34%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "6%" }} />
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
                  Program
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">
                  Total
                </th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">
                  Not started
                </th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">
                  In progress
                </th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">
                  Completed
                </th>
                <th scope="col" className="px-3 py-3 text-center font-semibold">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((item) => {
                const href = `/academy/admin/enrollments/program/${item.programId}`;
                const typeLabel = item.category.trim() || programTypeLabel(item.programType);
                return (
                  <tr
                    key={item.programId}
                    className="border-b align-middle transition-colors last:border-b-0 hover:bg-surface-soft"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <th scope="row" className="min-w-0 px-5 py-3.5 text-left font-medium sm:px-6">
                      <Link
                        href={href}
                        className="block truncate leading-snug text-ink no-underline transition-colors hover:text-accent"
                      >
                        {item.programName}
                      </Link>
                      <p
                        className="mt-0.5 text-[12px] font-normal"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {typeLabel}
                      </p>
                    </th>
                    <td className="px-3 py-3.5">
                      <Pill tone={statusTone(item.programStatus)}>
                        {programStatusLabel(item.programStatus)}
                      </Pill>
                    </td>
                    <td
                      className="px-3 py-3.5 text-center tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {item.total.toLocaleString()}
                    </td>
                    <td
                      className="px-3 py-3.5 text-center tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {item.enrolled.toLocaleString()}
                    </td>
                    <td
                      className="px-3 py-3.5 text-center tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {item.inProgress.toLocaleString()}
                    </td>
                    <td
                      className="px-3 py-3.5 text-center tabular-nums"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {item.completed.toLocaleString()}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <Link
                        href={href}
                        aria-label={`View enrollments for ${item.programName}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-ink no-underline transition-colors hover:bg-[color:var(--accent-tint)] hover:text-accent"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        <ChevronIcon />
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
                total={data.programs.length}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                showRange={false}
                label="Learner program pages"
                onPageChange={goToPage}
              />
            </div>
          </div>
        ) : null}
      </div>

      {data.truncatedPrograms ? (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Showing the 48 programs with the most enrollments.
        </p>
      ) : null}
      {data.truncatedScan ? (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Program totals are based on the first 2,000 enrollment records.
        </p>
      ) : null}
    </section>
  );
}
