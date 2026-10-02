"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { AdminHeader } from "@/academy/admin/components/AdminHeader";
import type { AdminInstructorListData, InstructorProgramOption } from "../types";
import { AddInstructorModal } from "./AddInstructorModal";
import { InstructorEmptyState } from "./InstructorEmptyState";
import { InviteSentView, type InviteSentDetails } from "./InviteSentView";
import { InstructorsTable } from "./InstructorsTable";
import { PendingInvitesTable } from "./PendingInvitesTable";

function matchesQuery(query: string, item: { displayName: string; email: string | null }) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.displayName.toLowerCase().includes(q) || (item.email?.toLowerCase().includes(q) ?? false)
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function InstructorsShell({
  data,
  programs,
}: {
  data: AdminInstructorListData;
  programs: InstructorProgramOption[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sent, setSent] = useState<InviteSentDetails | null>(null);
  const hasAny =
    data.active.length > 0 || data.suspended.length > 0 || data.pendingInvites.length > 0;

  const filteredActive = useMemo(
    () => data.active.filter((item) => matchesQuery(search, item)),
    [data.active, search],
  );
  const filteredSuspended = useMemo(
    () => data.suspended.filter((item) => matchesQuery(search, item)),
    [data.suspended, search],
  );
  const filteredInvites = useMemo(
    () => data.pendingInvites.filter((item) => matchesQuery(search, item)),
    [data.pendingInvites, search],
  );
  const hasMatches =
    filteredActive.length > 0 || filteredSuspended.length > 0 || filteredInvites.length > 0;
  const matchCount = filteredActive.length + filteredSuspended.length + filteredInvites.length;
  const totalCount = data.active.length + data.suspended.length + data.pendingInvites.length;
  const queryActive = search.trim().length > 0;

  const modal = modalOpen ? (
    <AddInstructorModal
      programs={programs}
      onClose={() => setModalOpen(false)}
      onSent={(next) => {
        setModalOpen(false);
        setSent(next);
        router.refresh();
      }}
    />
  ) : null;

  if (sent) {
    return (
      <div>
        <AdminHeader
          title="Instructors"
          description="Add instructors by hand and scope them to specific programs. There is no self-service instructor sign-up."
        />
        <InviteSentView
          sent={sent}
          onDone={() => {
            setSent(null);
            router.refresh();
          }}
          onAddAnother={() => setModalOpen(true)}
        />
        {modal}
      </div>
    );
  }

  const addButton = (
    <Button variant="primary" onClick={() => setModalOpen(true)}>
      Add instructor
    </Button>
  );

  if (!hasAny) {
    return (
      <>
        <InstructorEmptyState onAdd={() => setModalOpen(true)} />
        {modal}
      </>
    );
  }

  return (
    <div>
      <AdminHeader
        title="Instructors"
        description="Add instructors by hand and scope them to specific programs. There is no self-service instructor sign-up."
        actions={addButton}
      />

      <div
        className="mb-5 overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search instructors</span>
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center"
              style={{ color: "var(--text-tertiary)" }}
            >
              <SearchIcon />
            </span>
            <input
              name="instructor-search"
              value={search}
              autoComplete="off"
              placeholder="Search by name or email"
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-[10px] border bg-[var(--surface-soft)] py-2.5 pl-11 pr-10 text-[14px] outline-none transition-[border-color,box-shadow,background] placeholder:text-[var(--text-tertiary)] hover:border-[var(--text-quiet)] focus:border-accent focus:bg-white focus:shadow-[0_0_0_3px_var(--accent-tint)]"
              style={{ borderColor: "var(--border)", color: "var(--ink)" }}
            />
            {queryActive ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px] border-none bg-transparent transition-colors hover:bg-[var(--surface-active)]"
                style={{ color: "var(--text-secondary)" }}
              >
                <ClearIcon />
              </button>
            ) : null}
          </label>
          <p
            className="shrink-0 px-1 text-[12.5px] font-medium tabular-nums sm:pr-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {queryActive
              ? `${matchCount.toLocaleString()} of ${totalCount.toLocaleString()}`
              : `${totalCount.toLocaleString()} total`}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {!hasMatches ? (
          <div
            className="rounded-[12px] bg-surface px-5 py-8 text-center"
            style={{ border: "1px solid var(--border)" }}
          >
            <p className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
              No instructors match
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Nothing found for “{search.trim()}”. Try another name or email.
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-4 cursor-pointer border-none bg-transparent text-[13px] font-medium text-accent hover:text-accent-hover"
            >
              Clear search
            </button>
          </div>
        ) : null}

        {filteredInvites.length > 0 ? <PendingInvitesTable invites={filteredInvites} /> : null}

        {filteredActive.length > 0 ? (
          <InstructorsTable title="Active instructors" instructors={filteredActive} />
        ) : null}

        {filteredSuspended.length > 0 ? (
          <InstructorsTable title="Suspended" instructors={filteredSuspended} />
        ) : null}

        {data.truncatedActive || data.truncatedSuspended ? (
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Showing the first 48 instructors per status.
          </p>
        ) : null}
      </div>

      {modal}
    </div>
  );
}
