"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  QuestionBankAuthorScope,
  QuestionBankData,
  QuestionBankFilters,
  QuestionBankSummary,
} from "@/academy/lib/questionBank/types";
import { loadQuestionBankAction } from "@/academy/lib/questionBank/actions";
import { questionBankHref } from "@/academy/lib/questionBank/href";
import { Surface } from "@/academy/components/ui";
import type { QuestionBankActionMode } from "./QuestionBankInteractiveList";
import { QUESTION_BANK_RELOAD_EVENT } from "./AddQuestionComposer";
import { QuestionBankFiltersBar, QuestionBankPagination } from "./QuestionBankFilters";
import { QuestionBankInteractiveList } from "./QuestionBankInteractiveList";
import { QuestionBankSummaryLine } from "./QuestionBankSummary";

const EMPTY_SUMMARY: QuestionBankSummary = {
  total: 0,
  multipleChoice: 0,
  trueFalse: 0,
  exercise: 0,
  assignment: 0,
  other: 0,
  custom: 0,
  programCount: 0,
};

function cacheKey(filters: QuestionBankFilters) {
  return [
    filters.status,
    filters.type,
    filters.programId,
    filters.moduleId,
    filters.search.trim().toLowerCase(),
    String(filters.page),
  ].join("|");
}

function writeUrl(basePath: string, filters: QuestionBankFilters) {
  const href = questionBankHref(basePath, filters);
  if (typeof window === "undefined") return;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === href) return;
  window.history.replaceState(window.history.state, "", href);
}

export function QuestionBankResults({
  basePath,
  scope,
  data: initialData,
  emptyMessage,
  actionLabel,
  actionMode,
  canManageCustom = false,
}: {
  basePath: string;
  scope: QuestionBankAuthorScope;
  data: QuestionBankData;
  emptyMessage: string;
  actionLabel: string;
  actionMode: QuestionBankActionMode;
  canManageCustom?: boolean;
}) {
  const [data, setData] = useState(initialData);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef(
    new Map<string, QuestionBankData>([[cacheKey(initialData.activeFilters), initialData]]),
  );
  const requestId = useRef(0);
  const filtersRef = useRef(initialData.activeFilters);
  filtersRef.current = data.activeFilters;
  const prefetchingRef = useRef(new Set<string>());

  useEffect(() => {
    const key = cacheKey(initialData.activeFilters);
    cacheRef.current.set(key, initialData);
    setData(initialData);
  }, [initialData]);

  const prefetch = useCallback(
    (filters: QuestionBankFilters) => {
      const key = cacheKey(filters);
      if (cacheRef.current.has(key) || prefetchingRef.current.has(key)) return;

      prefetchingRef.current.add(key);
      void loadQuestionBankAction({ scope, filters })
        .then((result) => {
          if (!result.ok) return;
          cacheRef.current.set(cacheKey(result.data.activeFilters), result.data);
        })
        .finally(() => {
          prefetchingRef.current.delete(key);
        });
    },
    [scope],
  );

  const loadFilters = useCallback(
    (next: QuestionBankFilters, opts?: { keepVisible?: boolean; bustCache?: boolean }) => {
      const key = cacheKey(next);
      if (opts?.bustCache) cacheRef.current.delete(key);
      const cached = cacheRef.current.get(key);
      const statusChanged = next.status !== filtersRef.current.status;
      setError(null);
      writeUrl(basePath, next);

      if (cached) {
        setData(cached);
        setPending(false);
        if (next.status === "in_quiz") {
          prefetch({ ...next, status: "custom", moduleId: "", page: 1 });
        }
        return;
      }

      // Instant chrome: switch tab label/filters right away. Clear the list on
      // Library ↔ Custom so the wrong tab's rows don't linger.
      setData((current) => ({
        ...current,
        items: statusChanged || opts?.keepVisible === false ? [] : current.items,
        total: statusChanged || opts?.keepVisible === false ? 0 : current.total,
        summary:
          statusChanged || opts?.keepVisible === false ? { ...EMPTY_SUMMARY } : current.summary,
        activeFilters: next,
        filters: current.filters,
      }));
      setPending(true);

      const id = ++requestId.current;
      void loadQuestionBankAction({ scope, filters: next }).then((result) => {
        if (id !== requestId.current) return;
        setPending(false);
        if (!result.ok) {
          setError("Could not update the list. Try again.");
          return;
        }
        cacheRef.current.set(cacheKey(result.data.activeFilters), result.data);
        setData(result.data);
        if (result.data.activeFilters.status === "in_quiz") {
          prefetch({
            ...result.data.activeFilters,
            status: "custom",
            moduleId: "",
            page: 1,
          });
        }
      });
    },
    [basePath, prefetch, scope],
  );

  const applyFilters = useCallback(
    (patch: Partial<QuestionBankFilters>) => {
      const next: QuestionBankFilters = {
        ...filtersRef.current,
        page: patch.page ?? 1,
        ...patch,
      };
      if (patch.page === undefined) next.page = 1;
      if (patch.status === "custom") next.moduleId = "";
      loadFilters(next);
    },
    [loadFilters],
  );

  // Prefetch is intentional only for Custom (fast). Never prefetch Library —
  // that path scans course outlines and was making tab switches feel stuck.
  useEffect(() => {
    const current = data.activeFilters;
    if (current.status === "custom") return;
    prefetch({
      ...current,
      status: "custom",
      moduleId: "",
      page: 1,
    });
  }, [
    data.activeFilters.status,
    data.activeFilters.programId,
    data.activeFilters.type,
    data.activeFilters.search,
    prefetch,
  ]);

  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const next: QuestionBankFilters = {
        search: params.get("q") ?? "",
        type: (params.get("type") as QuestionBankFilters["type"]) || "all",
        programId: params.get("programId") ?? "",
        moduleId: params.get("moduleId") ?? "",
        status:
          params.get("status") === "in_quiz" ||
          params.get("status") === "all" ||
          params.get("status") === "library"
            ? "in_quiz"
            : "custom",
        page: Math.max(1, Number(params.get("page")) || 1),
      };
      loadFilters(next, { keepVisible: true });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [loadFilters]);

  useEffect(() => {
    function onReload(event: Event) {
      const detail = (
        event as CustomEvent<{
          status?: QuestionBankFilters["status"];
          programId?: string;
        }>
      ).detail;
      const status = detail?.status === "custom" ? "custom" : "in_quiz";
      // After adding a question (especially on a brand-new course), clear the
      // course filter so Custom shows every bank question — not only the
      // previously selected course.
      const programId =
        detail && "programId" in detail ? (detail.programId ?? "") : filtersRef.current.programId;
      const next: QuestionBankFilters = {
        ...filtersRef.current,
        status,
        programId,
        moduleId: "",
        page: 1,
      };
      cacheRef.current.clear();
      loadFilters(next, { bustCache: true, keepVisible: false });
    }
    window.addEventListener(QUESTION_BANK_RELOAD_EVENT, onReload);
    return () => window.removeEventListener(QUESTION_BANK_RELOAD_EVENT, onReload);
  }, [loadFilters]);

  const { items, total, pageSize, summary, filters, activeFilters } = data;
  const page = activeFilters.page;
  const customView = activeFilters.status === "custom";
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * pageSize, total);
  const showListSkeleton = pending && items.length === 0;

  return (
    <Surface elevated className="relative z-10 overflow-visible">
      <div
        className="border-b px-5 py-5 sm:px-6"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--module-academy-bg, #e9e4f3) 34%, white) 0%, var(--surface) 100%)",
        }}
      >
        <QuestionBankFiltersBar
          options={filters}
          filters={activeFilters}
          pending={pending}
          onChange={applyFilters}
        />
      </div>

      <section
        aria-labelledby="question-bank-results-heading"
        aria-busy={pending}
        className="transition-opacity duration-150"
        style={{ opacity: pending && items.length > 0 ? 0.72 : 1 }}
      >
        <div className="px-5 pt-5 pb-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--module-academy-fg)" }}
                >
                  {customView ? "Saved for later" : "Library"}
                </p>
                {total > 0 ? (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
                    style={{
                      background: "var(--surface-soft)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of{" "}
                    {total.toLocaleString()}
                  </span>
                ) : null}
                {pending ? (
                  <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                    Updating…
                  </span>
                ) : null}
              </div>
              <h2
                id="question-bank-results-heading"
                className="mt-1.5 text-[20px] font-semibold tracking-[-0.35px] text-pretty"
              >
                {customView ? "Questions saved for later" : "Question library"}
              </h2>
              <p
                className="mt-1.5 max-w-[58ch] text-[13.5px] leading-relaxed text-pretty"
                style={{ color: "var(--text-secondary)" }}
              >
                {customView
                  ? canManageCustom
                    ? "Banked for future quizzes and assignments. Admins can delete these when they are no longer needed."
                    : "Banked for future quizzes and assignments — add them when you build an assessment."
                  : !activeFilters.programId
                    ? "Pick a course to load its library. Scanning every course at once is skipped for speed."
                    : "Browse by course. Select questions, then place them in a quiz or assignment."}
              </p>
            </div>
          </div>
          {!showListSkeleton ? (
            <QuestionBankSummaryLine
              filters={activeFilters}
              summary={summary}
              onChange={applyFilters}
            />
          ) : null}
          {error ? (
            <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
              {error}
            </p>
          ) : null}
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }}>
          {showListSkeleton ? (
            <TabListSkeleton />
          ) : (
            <QuestionBankInteractiveList
              items={items}
              total={total}
              rangeStart={rangeStart}
            emptyMessage={
              customView
                ? "Nothing saved for later yet. Write a question here to keep it ready for a future quiz or assignment."
                : !activeFilters.programId
                  ? "Choose a course above to browse its quiz and assignment questions."
                  : emptyMessage
            }
              actionLabel={actionLabel}
              actionMode={actionMode}
              canManageCustom={canManageCustom}
            />
          )}
        </div>

        {pageCount > 1 && !showListSkeleton ? (
          <div
            className="border-t px-5 py-3.5 sm:px-6"
            style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
          >
            <QuestionBankPagination
              page={Math.min(page, pageCount)}
              pageCount={pageCount}
              total={total}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onPageChange={(nextPage) => applyFilters({ page: nextPage })}
            />
          </div>
        ) : null}
      </section>
    </Surface>
  );
}

function TabListSkeleton() {
  return (
    <div className="space-y-3 px-5 py-5 sm:px-6" aria-hidden>
      {[0, 1, 2, 3, 4].map((row) => (
        <div
          key={row}
          className="h-14 animate-pulse rounded-[11px]"
          style={{
            background: "var(--surface-soft)",
            boxShadow: "inset 0 0 0 1px var(--border)",
            animationDelay: `${row * 40}ms`,
          }}
        />
      ))}
    </div>
  );
}
