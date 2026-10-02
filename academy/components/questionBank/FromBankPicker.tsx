"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { loadAuthoringQuestionsAction } from "@/academy/lib/questionBank/actions";
import {
  questionBankTypeLabel,
  type AuthoringBankQuestion,
} from "@/academy/lib/questionBank/types";

const authoringCache = new Map<string, AuthoringBankQuestion[]>();

function cacheKey(programId: string | undefined) {
  return `${programId ?? "all"}:custom-bank`;
}

export function clearAuthoringBankCache() {
  authoringCache.clear();
}

function isGeneralItem(item: AuthoringBankQuestion) {
  return item.programName === "General" || item.programName === "General questions";
}

export function FromBankPicker({
  kind,
  programId,
  excludeIds,
  excludeTexts,
  disabled,
  remaining,
  label = "From question bank",
  onPick,
}: {
  kind: "quiz" | "assignment";
  programId: string;
  excludeIds?: string[];
  excludeTexts?: string[];
  disabled?: boolean;
  remaining?: number;
  label?: string;
  onPick: (questions: AuthoringBankQuestion[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded-[6px] border px-2.5 py-1.5 text-[13px] font-medium disabled:opacity-40"
        style={{ borderColor: "var(--border-strong)", color: "var(--ink)", background: "transparent" }}
      >
        {label}
      </button>
      {open ? (
        <FromBankModal
          kind={kind}
          programId={programId}
          excludeIds={excludeIds}
          excludeTexts={excludeTexts}
          remaining={remaining}
          onClose={() => setOpen(false)}
          onPick={(questions) => {
            onPick(questions);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function FromBankModal({
  kind,
  programId,
  excludeIds,
  excludeTexts,
  remaining,
  onClose,
  onPick,
}: {
  kind: "quiz" | "assignment";
  programId: string;
  excludeIds?: string[];
  excludeTexts?: string[];
  remaining?: number;
  onClose: () => void;
  onPick: (questions: AuthoringBankQuestion[]) => void;
}) {
  const titleId = useId();
  const [items, setItems] = useState<AuthoringBankQuestion[]>([]);
  const [scope, setScope] = useState<"course" | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    clearAuthoringBankCache();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const key = cacheKey(scope === "course" ? programId : undefined);
    const cached = authoringCache.get(key);
    if (cached) {
      setItems(cached);
      setError(null);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    void loadAuthoringQuestionsAction({
      programId: scope === "course" ? programId : undefined,
      // Custom / General bank only — not questions already sitting inside quizzes.
      bankOnly: true,
    }).then((result) => {
      if (id !== requestId.current) return;
      if (!result.ok) {
        setError("Questions could not be loaded.");
        setItems([]);
        setLoading(false);
        return;
      }
      const sorted = [...result.items].sort((a, b) => {
        const aG = isGeneralItem(a) ? 0 : 1;
        const bG = isGeneralItem(b) ? 0 : 1;
        if (aG !== bG) return aG - bG;
        return a.questionText.localeCompare(b.questionText);
      });
      authoringCache.set(key, sorted);
      setItems(sorted);
      setLoading(false);
    });
  }, [programId, scope]);

  const excludedIds = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);
  const excludedTexts = useMemo(
    () => new Set((excludeTexts ?? []).map((text) => text.trim().toLowerCase()).filter(Boolean)),
    [excludeTexts],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (kind === "quiz" && item.type === "assignment") return false;
      if (kind === "quiz" && item.type === "exercise") return false;
      if (kind === "quiz" && item.type === "other") return false;
      if (excludedIds.has(item.id)) return false;
      if (excludedTexts.has(item.questionText.trim().toLowerCase())) return false;
      if (!query) return true;
      return (
        item.questionText.toLowerCase().includes(query) ||
        item.lessonTitle.toLowerCase().includes(query) ||
        item.moduleTitle.toLowerCase().includes(query) ||
        item.programName.toLowerCase().includes(query)
      );
    });
  }, [excludedIds, excludedTexts, items, kind, search]);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const picked = visible.filter((item) => selected.has(item.id));
  const cap = remaining != null ? Math.max(0, remaining) : picked.length;
  const adding = remaining != null ? picked.slice(0, cap) : picked;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-3 py-3 sm:items-center sm:px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92vh,760px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[12px] bg-surface shadow-lg"
        style={{ border: "1px solid var(--border)" }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Saved for later
          </p>
          <h2 id={titleId} className="mt-1 text-[18px] font-semibold tracking-[-0.2px]">
            {kind === "quiz" ? "Add questions from the bank" : "Add prompts from the bank"}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Shows questions saved for later (including General) — not items already living inside other
            quizzes. Select what to copy into this {kind === "quiz" ? "quiz" : "assignment"}.
          </p>
        </div>

        <div className="border-b px-5 py-3 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="from-bank-search">
              Search questions
            </label>
            <input
              id="from-bank-search"
              type="search"
              value={search}
              placeholder="Search questions or courses"
              disabled={loading}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-[8px] border px-3 text-[14px] outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-50"
              style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
            />
            <div
              className="inline-flex rounded-[8px] p-0.5"
              style={{ background: "var(--surface-soft)", boxShadow: "inset 0 0 0 1px var(--border)" }}
            >
              <button
                type="button"
                disabled={loading}
                onClick={() => setScope("course")}
                className="h-8 rounded-[6px] border-0 px-2.5 text-[12.5px] font-medium disabled:opacity-50"
                style={{
                  background: scope === "course" ? "var(--surface)" : "transparent",
                  color: scope === "course" ? "var(--ink)" : "var(--text-secondary)",
                }}
              >
                This course
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setScope("all")}
                className="h-8 rounded-[6px] border-0 px-2.5 text-[12.5px] font-medium disabled:opacity-50"
                style={{
                  background: scope === "all" ? "var(--surface)" : "transparent",
                  color: scope === "all" ? "var(--ink)" : "var(--text-secondary)",
                }}
              >
                All courses
              </button>
            </div>
          </div>
        </div>

        <div className="relative min-h-[220px] flex-1 overflow-y-auto">
          {loading ? (
            <div
              className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 px-5 py-12"
              role="status"
              aria-live="polite"
            >
              <span
                className="inline-block size-8 animate-spin rounded-full border-2 border-transparent"
                style={{
                  borderTopColor: "var(--accent)",
                  borderRightColor: "var(--accent)",
                  borderBottomColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                  borderLeftColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                }}
                aria-hidden
              />
              <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
                Loading questions saved for later…
              </p>
            </div>
          ) : visible.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
              {kind === "quiz"
                ? "No questions saved for later yet. Add one under Question bank → Saved for later (General or a course)."
                : "No prompts saved for later yet. Add one under Question bank → Saved for later first."}
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {visible.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-5 py-3 sm:px-6">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium leading-snug text-pretty">
                        {item.questionText}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Pill
                          tone={
                            item.type === "true_false"
                              ? "info"
                              : item.type === "assignment"
                                ? "neutral"
                                : "accent"
                          }
                        >
                          {questionBankTypeLabel(item.type)}
                        </Pill>
                        {isGeneralItem(item) ? <Pill tone="success">General</Pill> : null}
                        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                          {item.programName}
                          <span className="px-1 opacity-40">·</span>
                          Not in a quiz yet
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? (
          <p className="px-5 py-3 text-[13.5px] sm:px-6" style={{ color: "var(--danger-fg)" }}>
            {error}
          </p>
        ) : null}

        <div
          className="flex justify-end gap-2 border-t px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        >
          <Button variant="secondary" disabled={loading} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={loading || adding.length === 0}
            onClick={() => onPick(adding)}
          >
            {adding.length === 0
              ? kind === "quiz"
                ? "Add to quiz"
                : "Add to assignment"
              : kind === "quiz"
                ? `Add ${adding.length} to quiz`
                : `Add ${adding.length} to assignment`}
          </Button>
        </div>
      </div>
    </div>
  );
}
