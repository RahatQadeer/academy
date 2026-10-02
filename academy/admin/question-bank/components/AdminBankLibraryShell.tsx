"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/base/components/Button";
import { cn } from "@/base/lib/cn";
import type { CourseTag } from "@/academy/lib/courseTags/types";
import { TagsManager } from "@/academy/admin/tags/components/TagsManager";
import { AddQuestionButton } from "@/academy/components/questionBank/AddQuestionComposer";

export type BankLibraryTab = "questions" | "tags";

function parseTab(raw: string | null): BankLibraryTab {
  return raw === "tags" ? "tags" : "questions";
}

const TABS = [
  {
    id: "questions" as const,
    label: "Questions",
    hint: "Reusable prompts",
    icon: QuestionIcon,
  },
  {
    id: "tags" as const,
    label: "Tags",
    hint: "Course topics",
    icon: TagIcon,
  },
] as const;

export function BankLibraryTabs({
  active,
  onChange,
}: {
  active: BankLibraryTab;
  onChange: (tab: BankLibraryTab) => void;
}) {
  return (
    <div
      className="relative flex min-w-0 items-stretch gap-1"
      role="tablist"
      aria-label="Library"
    >
      {TABS.map((tab) => {
        const selected = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-left transition-colors",
              "hover:bg-[var(--surface-soft)]",
            )}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-[8px] transition-colors"
              style={{
                background: selected
                  ? "var(--accent-tint, #e7f1fb)"
                  : "var(--surface-soft)",
                color: selected ? "var(--accent, #2383e2)" : "var(--text-tertiary)",
              }}
              aria-hidden
            >
              <Icon />
            </span>
            <span className="min-w-0">
              <span
                className="block text-[13.5px] font-semibold tracking-[-0.15px] leading-tight"
                style={{ color: selected ? "var(--ink)" : "var(--text-secondary)" }}
              >
                {tab.label}
              </span>
              <span
                className="mt-0.5 hidden text-[11.5px] leading-tight sm:block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {tab.hint}
              </span>
            </span>
            <span
              className="pointer-events-none absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full transition-opacity"
              style={{
                background: "var(--accent, #2383e2)",
                opacity: selected ? 1 : 0,
              }}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

/** Client shell: Questions | Tags on one Question bank page. */
export function AdminBankLibraryShell({
  tags,
  questions,
}: {
  tags: CourseTag[];
  questions: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<BankLibraryTab>(() => parseTab(searchParams.get("tab")));
  const [addTagOpen, setAddTagOpen] = useState(false);

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  const selectTab = useCallback(
    (next: BankLibraryTab) => {
      setTab(next);
      setAddTagOpen(false);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "tags") params.set("tab", "tags");
      else params.delete("tab");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <>
      <div
        className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b pb-0"
        style={{ borderColor: "var(--border)" }}
      >
        <BankLibraryTabs active={tab} onChange={selectTab} />
        <div className="pb-2.5">
          {tab === "questions" ? (
            <AddQuestionButton />
          ) : (
            <Button type="button" variant="primary" onClick={() => setAddTagOpen(true)}>
              Add Tag
            </Button>
          )}
        </div>
      </div>

      {tab === "tags" ? (
        <TagsManager
          initialTags={tags}
          addOpen={addTagOpen}
          onRequestAdd={() => setAddTagOpen(true)}
          onCloseAdd={() => setAddTagOpen(false)}
        />
      ) : (
        questions
      )}
    </>
  );
}

function QuestionIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 3.25h8A1.25 1.25 0 0 1 13.25 4.5v5.25A1.25 1.25 0 0 1 12 11H8.2L5.4 13.2a.4.4 0 0 1-.65-.31V11H4A1.25 1.25 0 0 1 2.75 9.75V4.5A1.25 1.25 0 0 1 4 3.25Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 6.35c.18-.55.7-.95 1.35-.95.8 0 1.35.5 1.35 1.2 0 .7-.55 1.05-1.1 1.3-.4.18-.6.4-.6.8v.2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle cx="7.55" cy="10" r=".7" fill="currentColor" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
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
