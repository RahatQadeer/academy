import Link from "next/link";
import { Button } from "@/base/components/Button";
import type { AcademyProgramStatus, AcademyPublishRequestStatus } from "@/academy/lib/domain";
import { programStatusLabel, publishRequestLabel } from "@/academy/instructor/utils/labels";

type Tab = "build" | "preview" | "settings";

export type InstructorPrimaryAction = "submit" | "publish" | "waiting" | "live";

export function instructorPrimaryAction(
  status: AcademyProgramStatus,
  requestStatus: AcademyPublishRequestStatus | null,
  isDirty: boolean,
): InstructorPrimaryAction {
  if (status === "published") return "live";
  if (requestStatus === "pending" || (status === "pending_approval" && requestStatus !== "approved")) {
    return "waiting";
  }
  if (requestStatus === "approved" && !isDirty) return "publish";
  return "submit";
}

export function InstructorCourseBuilderTopBar({
  programName,
  status,
  requestStatus,
  activeTab,
  onTabChange,
  onSave,
  saving,
  hasChanges,
  primaryAction,
  onPrimary,
  primaryPending,
}: {
  programName: string;
  status: AcademyProgramStatus;
  requestStatus: AcademyPublishRequestStatus | null;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onSave: () => void;
  saving?: boolean;
  hasChanges?: boolean;
  primaryAction: InstructorPrimaryAction;
  onPrimary: () => void;
  primaryPending?: boolean;
}) {
  const live = status === "published";
  const statusColor = live ? "#1c7a52" : status === "pending_approval" ? "var(--warning-fg)" : "var(--text-secondary)";

  return (
    <header
      className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4 sm:gap-4 sm:px-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Link
          href="/academy/instructor/programs"
          aria-label="Back to programs"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] no-underline hover:bg-black/[0.04]"
          style={{ color: "var(--text-secondary)" }}
        >
          <BackChevron />
        </Link>

        <div className="min-w-0">
          <p
            className="truncate text-[13.5px] font-semibold tracking-[-0.01em]"
            style={{ color: "var(--ink)" }}
            title={programName}
          >
            {programName.trim() || "Untitled program"}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            <span>Course builder</span>
            <span aria-hidden>·</span>
            <span style={{ color: statusColor }}>{programStatusLabel(status)}</span>
            {requestStatus && !live ? (
              <>
                <span aria-hidden>·</span>
                <span>{publishRequestLabel(requestStatus)}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <nav
        className="hidden shrink-0 rounded-[8px] border p-0.5 md:inline-flex"
        style={{ borderColor: "var(--border-strong)", background: "var(--surface-soft)" }}
      >
        {(["build", "preview", "settings"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className="rounded-[6px] px-3 py-1.5 text-[12.5px] font-medium"
            style={{
              color: activeTab === tab ? "var(--ink)" : "var(--text-tertiary)",
              background: activeTab === tab ? "var(--surface)" : "transparent",
              border: activeTab === tab ? "1px solid var(--border)" : "1px solid transparent",
              boxShadow: activeTab === tab ? "0 1px 2px rgba(15,15,15,.04)" : "none",
            }}
          >
            {tab === "build" ? "Build" : tab === "preview" ? "Preview" : "Settings"}
          </button>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-1.5">
        {live ? null : (
          <Button
            variant="secondary"
            className="!hidden !py-1.5 !text-[12.5px] sm:!inline-flex"
            onClick={onSave}
            disabled={saving || !hasChanges}
            title={!hasChanges ? "No changes to save" : undefined}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        )}
        {primaryAction === "live" ? (
          <Button variant="secondary" className="!py-1.5 !text-[12.5px]" disabled>
            Live in Explore
          </Button>
        ) : primaryAction === "waiting" ? (
          <Button variant="secondary" className="!py-1.5 !text-[12.5px]" disabled>
            Waiting for review
          </Button>
        ) : primaryAction === "publish" ? (
          <Button
            variant="primary"
            className="!py-1.5 !text-[12.5px]"
            onClick={onPrimary}
            disabled={primaryPending}
          >
            {primaryPending ? "Publishing…" : "Publish"}
          </Button>
        ) : (
          <Button
            variant="primary"
            className="!py-1.5 !text-[12.5px]"
            onClick={onPrimary}
            disabled={primaryPending || saving}
          >
            {primaryPending ? "Submitting…" : "Submit for approval"}
          </Button>
        )}
      </div>
    </header>
  );
}

function BackChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3.5L5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
