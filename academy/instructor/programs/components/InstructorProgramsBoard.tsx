"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { PaginationBar } from "@/academy/components/ui/PaginationBar";
import { WhitbyPromptCard } from "@/academy/admin/components/WhitbyPromptCard";
import { AssignedPrograms } from "@/academy/instructor/components/AssignedPrograms";
import { InstructorEmptyState } from "@/academy/instructor/components/InstructorEmptyState";
import { InstructorHeader } from "@/academy/instructor/components/InstructorHeader";
import type { InstructorProgramItem } from "@/academy/instructor/types";

const PAGE_SIZE = 8;

export function InstructorProgramsBoard({ programs }: { programs: InstructorProgramItem[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(programs.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rangeStart = programs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, programs.length);
  const paged = programs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showPager = pageCount > 1;

  function goToPage(nextPage: number) {
    setPage(nextPage);
    document.getElementById("instructor-programs-results")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <>
      <InstructorHeader
        title="My Programs"
        description="Generate a course with Whitby, or start from a blank outline. Publish when ready — Admin approval may still be required depending on your permissions."
        actions={
          <Button href="/academy/instructor/programs/new" variant="primary">
            <PlusIcon />
            New program
          </Button>
        }
      />

      <section
        id="instructor-programs-results"
        aria-label="Programs"
        className="min-w-0 overflow-x-hidden rounded-[16px] bg-surface"
        style={{
          border: "1px solid var(--border)",
          boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 10px 28px rgba(15,15,15,.04)",
        }}
      >
        <div className="px-5 py-4 sm:px-6" style={{ borderBottom: "1px solid var(--border)" }}>
          <WhitbyPromptCard framed={false} generatePath="/academy/instructor/programs/generating" />
        </div>

        {programs.length === 0 ? (
          <div className="px-5 py-2 sm:px-6">
            <InstructorEmptyState flush />
          </div>
        ) : (
          <>
            <AssignedPrograms
              framed={false}
              paginate={false}
              headingId="instructor-authorized-heading"
              title="Your programs"
              description="Open a program to keep building. Submit for approval when it is ready."
              programs={paged}
              totalCount={programs.length}
            />
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
                    total={programs.length}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    showRange={false}
                    label="My programs pages"
                    onPageChange={goToPage}
                  />
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="mr-1.5">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
