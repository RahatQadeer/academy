import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import {
  documentStatusLabel,
  documentStatusTone,
} from "@/partner-center/documents/lib/format";
import type { DocumentsRow } from "@/partner-center/documents/types";

/** F45 column template. */
const COLUMNS = "grid-cols-[2.2fr_1.4fr_1fr_1fr_1fr_60px]";

function iconBackground(row: DocumentsRow): string {
  if (row.status === "action_needed") return "var(--warning-bg)";
  if (row.status === "archived") return "var(--canvas)";
  if (row.programLabel === "Academy") {
    return "var(--module-academy-bg)";
  }
  return "var(--accent-tint)";
}

function isEmptyLabel(value: string | null | undefined): boolean {
  return !value || value === "—";
}

export function DocumentsTable({
  rows,
  emptyMessage,
}: {
  rows: DocumentsRow[];
  emptyMessage: string;
}) {
  return (
    <div className="pa-partner-card overflow-hidden">
      <div
        className={`grid ${COLUMNS} items-center px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.03em]`}
        style={{
          color: "var(--text-tertiary)",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-soft)",
        }}
      >
        <div>Name</div>
        <div>Labels</div>
        <div>Status</div>
        <div>Program</div>
        <div>Date</div>
        <div />
      </div>

      {rows.length === 0 ? (
        <div
          className="px-5 py-12 text-center text-[14px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {emptyMessage}
        </div>
      ) : (
        rows.map((row, index) => {
          const actionColor =
            row.neededAction === "review" ||
            row.neededAction === "sign_externally" ||
            row.neededAction === "upload" ||
            row.neededAction === "update"
              ? "var(--warning-fg)"
              : row.status === "archived"
                ? "var(--text-secondary)"
                : "var(--accent)";
          const isLast = index === rows.length - 1;

          return (
            <Link
              key={`${row.kind}-${row.id}`}
              href={row.actionHref}
              className={`grid ${COLUMNS} items-center px-5 py-3.5 no-underline transition-colors hover:bg-[var(--surface-soft)]`}
              style={{
                borderBottom: isLast ? undefined : "1px solid var(--border)",
                color: "var(--ink)",
              }}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px]"
                  style={{ background: iconBackground(row) }}
                  aria-hidden
                >
                  📄
                </span>
                <span
                  className="truncate text-[13.5px] font-medium"
                  style={{
                    color:
                      row.status === "archived"
                        ? "rgba(55,53,47,.6)"
                        : "var(--ink)",
                  }}
                >
                  {row.title}
                </span>
              </div>

              <div className="flex flex-wrap gap-[5px]">
                {row.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded px-2 py-0.5 text-[10.5px] font-medium"
                    style={{
                      background: "var(--canvas)",
                      color: "rgba(55,53,47,.65)",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div>
                <Pill tone={documentStatusTone(row.status)}>
                  {documentStatusLabel(row.status)}
                </Pill>
              </div>

              <div
                className="truncate text-[13.5px]"
                style={{ color: "var(--ink)" }}
              >
                {isEmptyLabel(row.programLabel) ? null : row.programLabel}
              </div>

              <div
                className="text-[13px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isEmptyLabel(row.dateLabel) ? null : row.dateLabel}
              </div>

              <div
                className="text-[13px] font-semibold"
                style={{ color: actionColor }}
              >
                {row.actionLabel}
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}
