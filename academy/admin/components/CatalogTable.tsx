"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pill } from "@/base/components/Pill";
import {
  deleteAdminCatalogProgramAction,
  unpublishAdminCatalogProgramAction,
} from "@/academy/admin/actions";
import {
  catalogProgramCanBeDeleted,
  catalogProgramDeletionMenuHint,
  catalogProgramDeletionMessage,
  getCatalogProgramDeletionBlock,
} from "@/academy/admin/lib/programDeletion";
import { ConfirmDialog } from "../catalog/components/ConfirmDialog";
import { CatalogRowMenu } from "./CatalogRowMenu";
import {
  CATALOG_TYPE_FILTERS,
  type CatalogFilter,
  type CatalogTypeFilter,
} from "./CatalogTabs";

export type CatalogProgram = {
  id: string;
  name: string;
  type: string;
  enrollmentCount: number;
  activeEnrollmentCount: number;
  status: "draft" | "pending_approval" | "published";
  updatedLabel: string;
};

const TYPE_LABELS: Record<string, string> = {
  short_course: "Short Course",
  course: "Course",
  certification_program: "Certification Program",
  endorsement_program: "Specialty Endorsement",
};

function ProgramGlyph() {
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
      style={{ background: "var(--surface-soft)", color: "var(--text-tertiary)" }}
      aria-hidden
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 4.2c1.7-1 4.3-1 6 0v8.6c-1.7-1-4.3-1-6 0V4.2ZM14 4.2c-1.7-1-4.3-1-6 0v8.6c1.7-1 4.3-1 6 0V4.2Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function statusLabel(status: CatalogProgram["status"], enrollmentCount: number) {
  if (status === "published") return "Published";
  if (status === "pending_approval") return "Pending";
  if (enrollmentCount > 0) return "Hidden";
  return "Draft";
}

function statusTone(status: CatalogProgram["status"]) {
  if (status === "published") return "success" as const;
  if (status === "pending_approval") return "warning" as const;
  return "neutral" as const;
}

const EMPTY_STATUS_COPY: Record<CatalogFilter, string> = {
  all: "No programs in the catalog yet.",
  published: "No programs are live yet. Publish a draft to make it visible in Explore.",
  pending_approval: "No programs are waiting for publish approval.",
  draft: "No drafts in progress. Every program is either live or awaiting approval.",
};

function emptyFilterCopy(filter: CatalogFilter, typeFilter: CatalogTypeFilter) {
  if (typeFilter !== "all") {
    const typeLabel =
      CATALOG_TYPE_FILTERS.find((option) => option.key === typeFilter)?.label ?? "this type";
    if (filter === "all") return `No ${typeLabel.toLowerCase()} programs in the catalog.`;
    return `No ${typeLabel.toLowerCase()} programs match this status.`;
  }
  return EMPTY_STATUS_COPY[filter];
}

export function CatalogTable({
  programs,
  filter,
  typeFilter = "all",
}: {
  programs: CatalogProgram[];
  filter: CatalogFilter;
  typeFilter?: CatalogTypeFilter;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<
    { kind: "delete" | "hide"; program: CatalogProgram } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (programs.length === 0) {
    return (
      <p
        className="px-6 py-16 text-center text-[13.5px] leading-relaxed text-pretty"
        style={{ color: "var(--text-tertiary)" }}
      >
        {emptyFilterCopy(filter, typeFilter)}
      </p>
    );
  }

  return (
    <div>
      {error ? (
        <p
          role="alert"
          className="border-b px-6 py-3 text-[13px] leading-relaxed"
          style={{ color: "var(--danger-fg)", borderColor: "var(--border)", background: "var(--danger-bg)" }}
        >
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[720px] table-fixed border-collapse text-left text-[13.5px]"
          style={{ color: "var(--ink)" }}
        >
          <caption className="sr-only">
            Academy programs with type, status, enrollments, and last update.
          </caption>
          <colgroup>
            <col style={{ width: "46%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr
              className="border-b text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-tertiary)",
                background: "var(--surface-soft)",
              }}
            >
              <th scope="col" className="px-5 py-3 font-semibold sm:px-6">
                Program
              </th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">
                Enrolled
              </th>
              <th scope="col" className="px-4 py-3 text-center font-semibold">
                Updated
              </th>
              <th scope="col" className="px-3 py-3 text-center font-semibold sm:px-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => {
              const deletionBlock = getCatalogProgramDeletionBlock({
                status: p.status,
                enrollmentCount: p.enrollmentCount,
                activeEnrollmentCount: p.activeEnrollmentCount,
              });
              const canDelete = catalogProgramCanBeDeleted({
                status: p.status,
                enrollmentCount: p.enrollmentCount,
                activeEnrollmentCount: p.activeEnrollmentCount,
              });

              return (
                <tr
                  key={p.id}
                  className="border-b align-middle transition-colors last:border-b-0 hover:bg-surface-soft"
                  style={{ borderColor: "var(--border)" }}
                >
                  <th scope="row" className="px-5 py-3.5 text-left align-middle font-medium sm:px-6">
                    <Link
                      href={`/academy/admin/catalog/${p.id}`}
                      className="group flex min-w-0 items-center gap-3 text-ink no-underline"
                    >
                      <ProgramGlyph />
                      <span className="min-w-0 flex flex-col gap-0.5">
                        <span className="truncate text-[13.5px] font-semibold leading-snug tracking-[-0.1px] transition-colors group-hover:text-accent">
                          {p.name}
                        </span>
                        <span
                          className="truncate text-[12px] font-medium leading-snug"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {TYPE_LABELS[p.type] ?? p.type}
                        </span>
                      </span>
                    </Link>
                  </th>
                  <td className="px-4 py-3.5 text-center align-middle">
                    <Pill tone={statusTone(p.status)}>{statusLabel(p.status, p.enrollmentCount)}</Pill>
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle tabular-nums">
                    {p.enrollmentCount > 0 ? (
                      <span className="text-[13.5px] font-medium text-ink">
                        {p.enrollmentCount.toLocaleString()}
                        {p.activeEnrollmentCount > 0 &&
                        p.activeEnrollmentCount !== p.enrollmentCount ? (
                          <span className="sr-only">
                            {`, ${p.activeEnrollmentCount.toLocaleString()} active`}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-disabled)" }} aria-label="0 enrolled">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center align-middle whitespace-nowrap tabular-nums">
                    {p.updatedLabel ? (
                      <span className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
                        {p.updatedLabel}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-disabled)" }} aria-hidden>
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-center align-middle sm:px-4">
                    <CatalogRowMenu
                      programName={p.name}
                      editHref={`/academy/admin/catalog/${p.id}`}
                      onHide={
                        p.status === "published"
                          ? () => {
                              setError(null);
                              setPending({ kind: "hide", program: p });
                            }
                          : undefined
                      }
                      deleteDisabled={!canDelete}
                      deleteDisabledReason={
                        deletionBlock ? catalogProgramDeletionMenuHint(deletionBlock) : undefined
                      }
                      onDelete={() => {
                        if (!canDelete) return;
                        setError(null);
                        setPending({ kind: "delete", program: p });
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pending ? (
        <ConfirmDialog
          title={pending.kind === "hide" ? "Hide this program?" : "Delete this program?"}
          body={
            pending.kind === "hide"
              ? `“${pending.program.name}” will leave Explore for new learners. Anyone already enrolled can keep learning and keep their certificates.`
              : `“${pending.program.name}” has no enrolled learners and is not published. It will be removed from the catalog. This cannot be undone.`
          }
          confirmLabel={pending.kind === "hide" ? "Hide from catalog" : "Delete"}
          pendingLabel={pending.kind === "hide" ? "Hiding…" : "Deleting…"}
          destructive={pending.kind === "delete"}
          pending={busy}
          onClose={() => {
            if (busy) return;
            setPending(null);
          }}
          onConfirm={async () => {
            if (pending.kind === "hide") {
              setBusy(true);
              const result = await unpublishAdminCatalogProgramAction(pending.program.id);
              setBusy(false);
              if (!result.ok) {
                setError(result.message ?? "The program could not be hidden.");
                setPending(null);
                return;
              }
              setPending(null);
              router.refresh();
              return;
            }

            if (
              !catalogProgramCanBeDeleted({
                status: pending.program.status,
                enrollmentCount: pending.program.enrollmentCount,
                activeEnrollmentCount: pending.program.activeEnrollmentCount,
              })
            ) {
              const block = getCatalogProgramDeletionBlock({
                status: pending.program.status,
                enrollmentCount: pending.program.enrollmentCount,
                activeEnrollmentCount: pending.program.activeEnrollmentCount,
              });
              setError(
                block
                  ? catalogProgramDeletionMessage(block, pending.program.activeEnrollmentCount)
                  : "The program could not be deleted.",
              );
              setPending(null);
              return;
            }
            setBusy(true);
            const result = await deleteAdminCatalogProgramAction(pending.program.id);
            setBusy(false);
            if (!result.ok) {
              setError(result.message ?? "The program could not be deleted.");
              setPending(null);
              return;
            }
            setPending(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
