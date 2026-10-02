"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { Button } from "@/base/components/Button";
import { PaginationBar } from "@/academy/components/ui/PaginationBar";
import { InstructorSubmissionBadge } from "@/academy/assignments/components/AssignmentStatusBadge";
import {
  formatAssignmentDateTime,
  formatAssignmentScore,
} from "@/academy/assignments/utils/labels";
import type { InstructorReviewQueueItem, InstructorReviewStatusFilter } from "../types";

const PAGE_SIZE = 10;

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

function InboxIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 13.5 7 8.8A2 2 0 0 1 8.75 7.8h6.5A2 2 0 0 1 17 8.8l2.5 4.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 13.5h3.2l1.1 1.8h6.4l1.1-1.8h3.2V18a1.7 1.7 0 0 1-1.7 1.7H6.2A1.7 1.7 0 0 1 4.5 18v-4.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function emptyCopy(status: InstructorReviewStatusFilter, hasPrograms: boolean, filtered: boolean) {
  if (!hasPrograms) {
    return {
      title: "No courses to review yet",
      body: "When you are assigned a published course, learner submissions will collect here for grading.",
    };
  }
  if (filtered) {
    return {
      title: "No matching submissions",
      body: "Nothing in this view matches the course, assignment, or learner filter. Clear a filter to widen the queue.",
    };
  }
  if (status === "graded") {
    return {
      title: "Nothing reviewed yet",
      body: "Graded assignments appear here after you assign marks. Pending work stays in the Pending tab until then.",
    };
  }
  if (status === "resubmission_required") {
    return {
      title: "No resubmissions outstanding",
      body: "When you ask a learner to revise, the item waits here until they submit again.",
    };
  }
  if (status === "all") {
    return {
      title: "No submissions yet",
      body: "Assignment work from your courses will appear here as soon as a learner submits.",
    };
  }
  return {
    title: "Nothing waiting for review",
    body: "When a learner submits an assignment in one of your courses, it lands here so you can grade it and unlock their certificate.",
  };
}

export function ReviewQueue({
  items,
  status,
  hasPrograms,
  filtered,
}: {
  items: InstructorReviewQueueItem[];
  status: InstructorReviewStatusFilter;
  hasPrograms: boolean;
  filtered: boolean;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rangeStart = items.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, items.length);
  const paged = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [status, filtered, items.length]);

  if (items.length === 0) {
    const copy = emptyCopy(status, hasPrograms, filtered);
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <div
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-[10px]"
          style={{ background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" }}
        >
          <InboxIcon />
        </div>
        <h3 className="text-[16px] font-semibold tracking-[-0.2px] text-pretty">{copy.title}</h3>
        <p
          className="mt-2 max-w-[44ch] text-[13.5px] leading-relaxed text-pretty"
          style={{ color: "var(--text-secondary)" }}
        >
          {copy.body}
        </p>
        {!hasPrograms ? (
          <div className="mt-5">
            <Button href="/academy/instructor/programs" variant="secondary">
              Open programs
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {pageCount > 1 ? (
        <div className="flex justify-end border-b px-5 py-3 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <PaginationBar
            compact
            page={currentPage}
            pageCount={pageCount}
            total={items.length}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            itemLabel="submissions"
            label="Review queue pages"
            onPageChange={setPage}
          />
        </div>
      ) : null}
      <div className="overflow-x-auto">
      <table
        className="w-full min-w-[720px] table-fixed border-collapse text-left"
        style={{ color: "var(--ink)" }}
      >
        <caption className="sr-only">Assignment submissions in this view.</caption>
        <colgroup>
          <col style={{ width: "28%" }} />
          <col style={{ width: "34%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "8%" }} />
        </colgroup>
        <thead>
          <tr
            className="border-y text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-tertiary)",
              background: "var(--surface-soft)",
            }}
          >
            <th scope="col" className="px-5 py-2.5 font-semibold sm:px-6">
              Learner
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Assignment
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Submitted
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Status
            </th>
            <th scope="col" className="px-3 py-2.5 text-center font-semibold">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {paged.map((item, index) => {
            const href = `/academy/instructor/reviews/${item.id}`;
            return (
              <tr
                key={item.id}
                className="border-b align-middle transition-colors last:border-b-0 hover:bg-surface-soft"
                style={{ borderColor: "var(--border)" }}
              >
                <th scope="row" className="px-5 py-3.5 text-left font-medium sm:px-6">
                  <Link href={href} className="flex items-center gap-3 text-ink no-underline hover:text-accent">
                    <Avatar name={item.learnerName} size={36} tone={index % 2 === 0 ? "tan" : "blue"} />
                    <span className="min-w-0">
                      <span className="block truncate leading-snug">{item.learnerName}</span>
                      {item.learnerEmail ? (
                        <span
                          className="mt-0.5 block truncate text-[12px] font-normal"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {item.learnerEmail}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </th>
                <td className="px-4 py-3.5">
                  <Link href={href} className="block text-ink no-underline hover:text-accent">
                    <span className="block truncate text-[13.5px] font-medium leading-snug">
                      {item.lessonTitle}
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                      {item.programName}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                    {item.submittedAt ? formatAssignmentDateTime(item.submittedAt) : "—"}
                  </p>
                  {item.status === "graded" ? (
                    <p className="mt-0.5 text-[12.5px] font-medium tabular-nums" style={{ color: "var(--ink)" }}>
                      {formatAssignmentScore(item.score, item.maxScore)}
                    </p>
                  ) : item.attemptCount > 1 ? (
                    <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      Attempt {item.attemptCount}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3.5">
                  <InstructorSubmissionBadge status={item.status} />
                </td>
                <td className="px-3 py-3.5 text-center">
                  <Link
                    href={href}
                    aria-label={`Review ${item.learnerName}`}
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
      {pageCount > 1 ? (
        <div
          className="border-t px-5 py-3.5 sm:px-6"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        >
          <PaginationBar
            page={currentPage}
            pageCount={pageCount}
            total={items.length}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            itemLabel="submissions"
            label="Review queue pages"
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
