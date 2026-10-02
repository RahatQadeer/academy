"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { AcademyInterestId } from "@/academy/onboarding/lib/interests";
import { rankRecommendedPrograms } from "@/academy/dashboard/lib/rankRecommendations";
import { PaginationBar } from "@/academy/components/ui/PaginationBar";
import type {
  ExploreCatalogData,
  ExploreCatalogQuery,
  ExploreRecognitionFilter,
  ExploreSort,
} from "../types";
import type { AcademyCourseAccess } from "@/academy/lib/domain";
import { sortCatalogPrograms } from "../utils/catalogSequence";
import { isFreeProgram } from "../utils/accessState";
import {
  exploreHref,
  matchesCatalogSearch,
  matchesCertificateFilter,
  sanitizeCatalogSearch,
} from "../utils/query";
import { EmptyExploreState } from "./EmptyExploreState";
import { ExploreHeader } from "./ExploreHeader";
import { ExploreSearchBar } from "./ExploreSearchBar";
import { ProgramCatalog } from "./ProgramCatalog";
import { ProgramFilters } from "./ProgramFilters";
import { ProgramGrid } from "./ProgramGrid";

const PAGE_SIZE = 9;

function matchesRecognitionAccess(
  program: ExploreCatalogData["programs"][number],
  recognition: ExploreRecognitionFilter,
  access: AcademyCourseAccess | "",
) {
  if (!matchesCertificateFilter(program, recognition)) return false;
  // Free / Paid = price, not access-mode tags (avoids $0 "Open" showing under Paid).
  if (access === "free" && !isFreeProgram(program.price)) return false;
  if (access === "purchased" && isFreeProgram(program.price)) return false;
  if (access && access !== "free" && access !== "purchased" && program.accessMode !== access) {
    return false;
  }
  return true;
}

export function ExploreWorkbench({
  data,
  interestIds = [],
}: {
  data: ExploreCatalogData;
  interestIds?: AcademyInterestId[];
}) {
  const [search, setSearch] = useState(data.query.q);
  const [recognition, setRecognition] = useState<ExploreRecognitionFilter>(
    data.query.recognition ?? "",
  );
  const [access, setAccess] = useState<AcademyCourseAccess | "">(data.query.access);
  const [sort, setSort] = useState<ExploreSort>(data.query.sort);
  const [page, setPage] = useState(data.query.page ?? 1);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSearch(data.query.q);
    setRecognition(data.query.recognition ?? "");
    setAccess(data.query.access);
    setSort(data.query.sort);
    setPage(data.query.page ?? 1);
  }, [
    data.query.q,
    data.query.recognition,
    data.query.access,
    data.query.sort,
    data.query.page,
  ]);

  const deferredSearch = useDeferredValue(sanitizeCatalogSearch(search));

  const nextQuery: ExploreCatalogQuery = useMemo(
    () => ({
      q: deferredSearch,
      type: "",
      recognition,
      access,
      price: "",
      sort,
      page,
    }),
    [deferredSearch, recognition, access, sort, page],
  );

  const programs = useMemo(() => {
    const filtered = data.programs.filter(
      (program) =>
        matchesRecognitionAccess(program, recognition, access) &&
        matchesCatalogSearch(program, deferredSearch),
    );
    return sortCatalogPrograms(filtered, sort);
  }, [data.programs, recognition, access, deferredSearch, sort]);

  const pageCount = Math.max(1, Math.ceil(programs.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const rangeStart = programs.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, programs.length);
  const paged = programs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const showPager = pageCount > 1;

  const recommended = useMemo(() => {
    const focused = interestIds.filter((id) => id !== "exploring");
    if (!focused.length) return [];
    return rankRecommendedPrograms(programs, interestIds, 3);
  }, [programs, interestIds]);

  const skipFilterReset = useRef(true);

  useEffect(() => {
    if (skipFilterReset.current) {
      skipFilterReset.current = false;
      return;
    }
    setPage(1);
  }, [deferredSearch, recognition, access, sort]);

  useEffect(() => {
    const href = exploreHref({ ...nextQuery, page: currentPage });
    const timer = window.setTimeout(() => {
      window.history.replaceState(window.history.state, "", href);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [nextQuery, currentPage]);

  function applyFilters(next: Pick<ExploreCatalogQuery, "recognition" | "access">) {
    startTransition(() => {
      setRecognition(next.recognition);
      setAccess(next.access);
      setPage(1);
    });
  }

  function applySort(next: ExploreSort) {
    startTransition(() => {
      setSort(next);
      setPage(1);
    });
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    document.getElementById("explore-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <ExploreHeader resultCount={programs.length} query={nextQuery} />

      <div
        className="sticky top-0 z-20 -mx-1 rounded-[12px] border border-line bg-surface/95 px-3.5 py-3 backdrop-blur-md sm:px-4"
        style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 10px 28px rgba(15,15,15,.045)" }}
      >
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <ExploreSearchBar
            value={search}
            onChange={setSearch}
            onClear={() => {
              setSearch("");
              setPage(1);
            }}
          />
          <ProgramFilters
            query={nextQuery}
            sort={sort}
            onChange={applyFilters}
            onSortChange={applySort}
            onClearAll={() => {
              setSearch("");
              applyFilters({ recognition: "", access: "" });
              applySort("sequence");
            }}
          />
        </div>
      </div>

      <div id="explore-results" className="mt-8">
        {programs.length === 0 ? (
          <EmptyExploreState
            query={nextQuery}
            onClear={() => {
              setSearch("");
              applyFilters({ recognition: "", access: "" });
              applySort("sequence");
            }}
          />
        ) : (
          <>
            {showPager ? (
              <ProgramGrid programs={paged} />
            ) : (
              <ProgramCatalog programs={programs} query={nextQuery} recommended={recommended} />
            )}
            {showPager ? (
              <div className="mt-8">
                <PaginationBar
                  page={currentPage}
                  pageCount={pageCount}
                  total={programs.length}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  showRange={false}
                  label="Explore catalog pages"
                  onPageChange={goToPage}
                />
              </div>
            ) : null}
            {data.truncated && !nextQuery.q && !nextQuery.recognition && !nextQuery.access ? (
              <p className="mt-6 text-center text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                Showing the first {data.programs.length} published programs.
              </p>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
