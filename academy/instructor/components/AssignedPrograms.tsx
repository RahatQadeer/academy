"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { PaginationBar } from "@/academy/components/ui/PaginationBar";
import { programTypeLabel } from "@/academy/lib/domain";
import type { InstructorProgramItem } from "../types";
import {
  formatInstructorDate,
  permissionLabel,
  structureLabel,
} from "../utils/labels";
import { InstructorStatus } from "./InstructorStatus";

const PAGE_SIZE = 10;
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

function ProgramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 3.2h7.2A2.3 2.3 0 0 1 12.5 5.5V13H5.2A2.2 2.2 0 0 0 3 13.2V3.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 13.2A2.2 2.2 0 0 1 5.2 11H12.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AssignedPrograms({
  title,
  description = "Open a program to edit the draft. Publish still goes through admin.",
  programs,
  headingId,
  framed = true,
  paginate = true,
  totalCount,
}: {
  title: string;
  description?: string;
  programs: InstructorProgramItem[];
  headingId?: string;
  framed?: boolean;
  paginate?: boolean;
  totalCount?: number;
}) {
  const [page, setPage] = useState(1);
  const pageCount = paginate ? Math.max(1, Math.ceil(programs.length / PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, pageCount);
  const rangeStart = programs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, programs.length);
  const paged = paginate
    ? programs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : programs;
  const showPager = paginate && pageCount > 1;
  const displayCount = totalCount ?? programs.length;

  const pager = (
    <PaginationBar
      page={currentPage}
      pageCount={pageCount}
      total={programs.length}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      itemLabel="programs"
      label={`${title} pages`}
      onPageChange={setPage}
    />
  );

  const table = (
    <div className="min-w-0 overflow-x-hidden">
      <table
        className="w-full table-fixed border-collapse text-left text-[13.5px]"
        style={{ color: "var(--ink)" }}
      >
        <caption className="sr-only">{title}</caption>
        <colgroup>
          <col />
          <col style={{ width: "16%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "2.75rem" }} />
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
            <th scope="col" className="hidden px-3 py-3 font-semibold lg:table-cell">
              Type
            </th>
            <th scope="col" className="hidden px-3 py-3 font-semibold lg:table-cell">
              Access
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="hidden px-3 py-3 font-semibold md:table-cell">
              Updated
            </th>
            <th scope="col" className="px-2 py-3 text-center font-semibold">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {paged.map((item) => {
            const href = `/academy/instructor/programs/${item.programId}`;
            const typeLabel = item.category?.trim() || programTypeLabel(item.programType);
            return (
              <tr
                key={item.assignmentId}
                className="border-b align-middle transition-colors last:border-b-0 hover:bg-surface-soft"
                style={{ borderColor: "var(--border)" }}
              >
                <th scope="row" className="min-w-0 px-5 py-3.5 text-left font-medium sm:px-6">
                  <Link
                    href={href}
                    className="flex min-w-0 items-center gap-3 text-ink no-underline hover:text-accent"
                  >
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]"
                      style={{
                        background: "var(--module-academy-bg)",
                        color: "var(--module-academy-fg)",
                      }}
                    >
                      <ProgramGlyph />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate leading-snug">{item.programName}</span>
                      <span
                        className="mt-0.5 block truncate text-[12px] font-normal"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {structureLabel(item.moduleCount, item.lessonCount)}
                      </span>
                    </span>
                  </Link>
                </th>
                <td className="hidden min-w-0 px-3 py-3.5 lg:table-cell">
                  <span className="block truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    {typeLabel}
                  </span>
                </td>
                <td className="hidden min-w-0 px-3 py-3.5 lg:table-cell">
                  <Pill tone="neutral">{permissionLabel(item.permissionLevel)}</Pill>
                </td>
                <td className="min-w-0 px-3 py-3.5">
                  <InstructorStatus
                    programStatus={item.programStatus}
                    publishRequestStatus={item.publishRequestStatus}
                  />
                </td>
                <td
                  className="hidden px-3 py-3.5 md:table-cell"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <span className="block truncate">{formatInstructorDate(item.updatedAt)}</span>
                </td>
                <td className="px-2 py-3.5 text-center">
                  <Link
                    href={href}
                    aria-label={`Open ${item.programName}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] no-underline transition-colors hover:bg-[color:var(--accent-tint)] hover:text-accent"
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
  );

  const heading = (
    <div
      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="min-w-0">
        <h2 id={headingId} className="text-[15px] font-semibold tracking-[-0.2px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-[64ch] text-[13px] leading-snug text-pretty" style={{ color: "var(--text-secondary)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {showPager ? (
        <PaginationBar
          compact
          page={currentPage}
          pageCount={pageCount}
          total={programs.length}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          itemLabel="programs"
          label={`${title} pages`}
          onPageChange={setPage}
        />
      ) : (
        <p className="shrink-0 pt-0.5 text-[12.5px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
          {displayCount.toLocaleString()}
        </p>
      )}
    </div>
  );

  if (!framed) {
    return (
      <div aria-labelledby={headingId}>
        {heading}
        {table}
        {pageCount > 1 ? (
          <div
            className="border-t px-5 py-3.5 sm:px-6"
            style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
          >
            {pager}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <div
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        {heading}
        {table}
        {pageCount > 1 ? (
          <div
            className="border-t px-5 py-3.5 sm:px-6"
            style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
          >
            {pager}
          </div>
        ) : null}
      </div>
    </section>
  );
}
