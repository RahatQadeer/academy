"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import {
  archiveCourseTagAction,
  createCourseTagAction,
  restoreCourseTagAction,
} from "@/academy/lib/courseTags/actions";
import type { CourseTag } from "@/academy/lib/courseTags/types";

type Filter = "all" | "premade" | "custom" | "hidden";

export function TagsManager({
  initialTags,
  onRequestAdd,
  addOpen,
  onCloseAdd,
}: {
  initialTags: CourseTag[];
  onRequestAdd?: () => void;
  addOpen?: boolean;
  onCloseAdd?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [internalAdd, setInternalAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const showAdd = addOpen ?? internalAdd;
  function openAdd() {
    if (onRequestAdd) onRequestAdd();
    else setInternalAdd(true);
  }
  function closeAdd() {
    if (onCloseAdd) onCloseAdd();
    else setInternalAdd(false);
  }

  const active = useMemo(
    () => initialTags.filter((tag) => !tag.archivedAt),
    [initialTags],
  );
  const hidden = useMemo(
    () => initialTags.filter((tag) => tag.isPremade && tag.archivedAt),
    [initialTags],
  );

  const premadeCount = active.filter((t) => t.isPremade).length;
  const customCount = active.filter((t) => !t.isPremade).length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool =
      filter === "hidden"
        ? hidden
        : filter === "premade"
          ? active.filter((t) => t.isPremade)
          : filter === "custom"
            ? active.filter((t) => !t.isPremade)
            : active;

    if (!needle) return pool;
    return pool.filter((tag) => tag.name.toLowerCase().includes(needle));
  }, [active, hidden, filter, query]);

  function refresh() {
    router.refresh();
  }

  function submitNewTag() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await createCourseTagAction(newName);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNewName("");
      closeAdd();
      setFilter("custom");
      setNotice(`Added “${result.tag.name}”.`);
      refresh();
    });
  }

  function removeTag(tag: CourseTag) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await archiveCourseTagAction(tag.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(
        tag.isPremade
          ? `Hid “${tag.name}” from the bank.`
          : `Removed “${tag.name}” from the bank.`,
      );
      refresh();
    });
  }

  function restoreTag(tag: CourseTag) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await restoreCourseTagAction(tag.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(`Restored “${tag.name}”.`);
      setFilter("all");
      refresh();
    });
  }

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: active.length },
    { id: "premade", label: "Built-in", count: premadeCount },
    { id: "custom", label: "Custom", count: customCount },
    ...(hidden.length > 0
      ? [{ id: "hidden" as const, label: "Hidden", count: hidden.length }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex w-fit max-w-full flex-wrap rounded-[8px] border p-0.5"
          style={{ borderColor: "var(--border-strong)", background: "var(--surface-soft)" }}
          role="tablist"
          aria-label="Filter tags"
        >
          {filters.map((item) => {
            const selected = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(item.id)}
                className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors"
                style={{
                  background: selected ? "var(--surface)" : "transparent",
                  color: selected ? "var(--ink)" : "var(--text-tertiary)",
                  border: selected ? "1px solid var(--border)" : "1px solid transparent",
                  boxShadow: selected ? "0 1px 2px rgba(15,15,15,.04)" : "none",
                }}
              >
                {item.label}
                <span
                  className="tabular-nums"
                  style={{ color: selected ? "var(--text-secondary)" : "var(--text-disabled, rgba(55,53,47,.3))" }}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:max-w-[280px] sm:flex-1">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search tags</span>
            <span
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-tertiary)" }}
              aria-hidden
            >
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search…"
              className="w-full rounded-[6px] border bg-surface py-2 pl-8 pr-3 text-[13.5px] outline-none transition-[border-color,box-shadow] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(35,131,226,.10)]"
              style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
            />
          </label>
          {!onRequestAdd ? (
            <Button type="button" variant="primary" onClick={openAdd} disabled={pending}>
              Add Tag
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p
          className="rounded-[6px] px-3 py-2 text-[13px]"
          style={{ background: "var(--success-bg, #d6ecd8)", color: "var(--success-fg, #1c7a52)" }}
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-[6px] border px-3 py-2 text-[13px]"
          style={{
            background: "var(--warning-bg, #fdf7ee)",
            color: "var(--warning-fg, #7a5a2e)",
            borderColor: "var(--warning-border, #f2e2ca)",
          }}
        >
          {error}
        </p>
      ) : null}

      <div
        className="overflow-hidden rounded-[10px] border"
        style={{ borderColor: "var(--border)", background: "var(--border)" }}
      >
        {visible.length === 0 ? (
          <div className="bg-surface">
            <EmptyState
              filter={filter}
              hasQuery={Boolean(query.trim())}
              onClearSearch={() => setQuery("")}
              onAdd={!onRequestAdd || filter === "custom" || filter === "all" ? openAdd : undefined}
            />
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((tag) => (
              <li key={tag.id} className="bg-surface">
                <TagCard
                  tag={tag}
                  pending={pending}
                  hidden={filter === "hidden"}
                  onRemove={filter === "hidden" ? undefined : removeTag}
                  onRestore={filter === "hidden" ? restoreTag : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        Authors pick up to 3 tags when creating a program.
        {filter === "hidden"
          ? " Hidden tags stay on programs that already use them."
          : " Hide a built-in tag to keep it off new programs."}
      </p>

      {showAdd ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(55,53,47,.28)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-tag-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAdd();
          }}
        >
          <div
            className="w-full max-w-[400px] overflow-hidden rounded-[10px] border bg-surface shadow-[0_12px_40px_rgba(15,15,15,.12)]"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
              <h2 id="add-tag-title" className="text-[16px] font-semibold tracking-[-0.2px]">
                Add Tag
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Custom tags appear beside built-in ones when creating a course.
              </p>
            </div>
            <div className="px-5 py-4">
              <Input
                label="Tag name"
                name="tag-name"
                value={newName}
                maxLength={64}
                autoFocus
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitNewTag();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeAdd();
                  }
                }}
              />
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="secondary" disabled={pending} onClick={closeAdd}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={pending || !newName.trim()}
                  onClick={submitNewTag}
                >
                  {pending ? "Saving…" : "Create tag"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TagCard({
  tag,
  pending,
  hidden,
  onRemove,
  onRestore,
}: {
  tag: CourseTag;
  pending: boolean;
  hidden?: boolean;
  onRemove?: (tag: CourseTag) => void;
  onRestore?: (tag: CourseTag) => void;
}) {
  const programs =
    typeof tag.programCount === "number" && tag.programCount > 0 ? tag.programCount : 0;

  return (
    <div className="group flex h-full min-h-[68px] items-start gap-3 bg-surface px-4 py-3.5 transition-colors hover:bg-[var(--surface-soft)]">
      <span
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[8px] text-[12px] font-semibold"
        style={{
          background: hidden
            ? "var(--surface-soft)"
            : tag.isPremade
              ? "var(--module-academy-bg, #e9e4f3)"
              : "var(--accent-tint, #e7f1fb)",
          color: hidden
            ? "var(--text-tertiary)"
            : tag.isPremade
              ? "var(--module-academy-fg, #6b4fa8)"
              : "var(--accent, #2383e2)",
        }}
        aria-hidden
      >
        {tag.name.slice(0, 1).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[14px] font-medium tracking-[-0.1px]"
          style={{ color: hidden ? "var(--text-secondary)" : "var(--ink)" }}
          title={tag.name}
        >
          {tag.name}
        </p>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {tag.isPremade ? "Built-in" : "Custom"}
          {programs > 0 ? ` · ${programs} program${programs === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      {onRestore ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => onRestore(tag)}
          className="shrink-0 rounded-[6px] border bg-surface px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-[var(--surface-soft)] disabled:opacity-40"
          style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}
        >
          Restore
        </button>
      ) : onRemove ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => onRemove(tag)}
          aria-label={tag.isPremade ? `Hide ${tag.name}` : `Remove ${tag.name}`}
          title={tag.isPremade ? "Hide" : "Remove"}
          className="flex size-7 shrink-0 items-center justify-center rounded-[6px] opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40"
          style={{ color: "var(--text-tertiary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--danger-bg, #ffe2dd)";
            e.currentTarget.style.color = "var(--danger-fg, #5d1715)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-tertiary)";
          }}
        >
          <CloseIcon />
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({
  filter,
  hasQuery,
  onClearSearch,
  onAdd,
}: {
  filter: Filter;
  hasQuery: boolean;
  onClearSearch: () => void;
  onAdd?: () => void;
}) {
  const copy = hasQuery
    ? {
        title: "No matches",
        body: "Try a different search, or clear it to see all tags.",
      }
    : filter === "custom"
      ? {
          title: "No custom tags yet",
          body: "Add a tag for topics that aren’t in the built-in list.",
        }
      : filter === "hidden"
        ? {
            title: "Nothing hidden",
            body: "Hidden built-in tags will show up here.",
          }
        : {
            title: "No tags",
            body: "Tags authors can pick when creating a program will appear here.",
          };

  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span
        className="mb-3 flex size-11 items-center justify-center rounded-[10px]"
        style={{ background: "var(--surface-soft)", color: "var(--text-tertiary)" }}
        aria-hidden
      >
        <TagIcon />
      </span>
      <p className="text-[14.5px] font-medium tracking-[-0.15px]">{copy.title}</p>
      <p className="mt-1 max-w-[36ch] text-[13px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        {copy.body}
      </p>
      <div className="mt-4 flex items-center gap-2">
        {hasQuery ? (
          <Button type="button" variant="secondary" onClick={onClearSearch}>
            Clear search
          </Button>
        ) : null}
        {onAdd && !hasQuery && filter !== "hidden" ? (
          <Button type="button" variant="primary" onClick={onAdd}>
            Add Tag
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 8.2V3.5A1 1 0 0 1 3.5 2.5h4.7a1 1 0 0 1 .7.3l4.8 4.8a1 1 0 0 1 0 1.4l-4.7 4.7a1 1 0 0 1-1.4 0L2.8 8.9a1 1 0 0 1-.3-.7Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="5.75" cy="5.75" r="1" fill="currentColor" />
    </svg>
  );
}
