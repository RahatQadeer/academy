"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import { Button } from "@/base/components/Button";
import { pcType } from "@/partner-center/lib/typography";
import type { DocumentLabelGroup } from "@/partner-center/documents/types";
import { RenameLabelModal } from "@/partner-center/documents/components/RenameLabelModal";

export function MyLabelsPanel({
  groups,
  canMutate,
  onSelectLabel,
}: {
  groups: DocumentLabelGroup[];
  canMutate: boolean;
  onSelectLabel: (label: string) => void;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <div
        className="mt-4 rounded-[10px] px-8 py-14 text-center"
        style={{
          border: "1px dashed var(--border-strong)",
          background: "var(--surface)",
        }}
      >
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[10px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          aria-hidden
        >
          <Tag size={22} strokeWidth={2.25} />
        </div>
        <div className={`${pcType.title} mb-1.5`} style={{ color: "var(--ink)" }}>
          No labels yet
        </div>
        <p
          className={`${pcType.body} m-0 mx-auto max-w-sm`}
          style={{ color: "var(--text-secondary)" }}
        >
          Add a label on any document and it will show up here so you can find
          and rename it later.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 mb-4">
        <p
          className={`${pcType.body} m-0 max-w-xl`}
          style={{ color: "var(--text-secondary)" }}
        >
          Labels help you group documents. Open one to filter the library, or
          rename it across every file that uses it.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const countLabel =
            group.count === 1 ? "1 document" : `${group.count} documents`;

          return (
            <div
              key={group.label}
              className="pa-partner-card group flex flex-col transition-shadow hover:shadow-[0_1px_2px_rgba(15,15,15,0.05),0_12px_28px_-16px_rgba(45,106,79,0.18)]"
            >
              <button
                type="button"
                onClick={() => onSelectLabel(group.label)}
                className="flex min-w-0 flex-1 items-start gap-3.5 border-0 bg-transparent px-4 py-4 text-left transition-colors hover:bg-[var(--surface-soft)]"
                style={{ color: "var(--ink)", borderRadius: "10px 10px 0 0" }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]"
                  style={{
                    background: "var(--accent-tint)",
                    color: "var(--accent)",
                  }}
                  aria-hidden
                >
                  <Tag size={18} strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span
                    className={`block truncate ${pcType.bodyStrong}`}
                    title={group.label}
                  >
                    {group.label}
                  </span>
                  <span
                    className={`mt-0.5 block ${pcType.meta}`}
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {countLabel}
                  </span>
                </span>
                <span
                  className={`${pcType.metaMedium} mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100`}
                  style={{ color: "var(--accent)" }}
                >
                  View →
                </span>
              </button>

              {canMutate ? (
                <div
                  className="flex items-center justify-end px-3 py-2"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-2.5 py-1.5 text-[12.5px]"
                    onClick={() => setRenaming(group.label)}
                  >
                    Rename
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {renaming ? (
        <RenameLabelModal
          from={renaming}
          onClose={() => setRenaming(null)}
          onDone={() => {
            setRenaming(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
