"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { AdminHeader } from "@/academy/admin/components/AdminHeader";
import type { AcademyAdminListData } from "../types";
import { AddAdminModal } from "./AddAdminModal";
import { AdminEmptyState } from "./AdminEmptyState";
import { AdminsTable } from "./AdminsTable";
import { PendingAdminInvitesTable } from "./PendingAdminInvitesTable";

function matchesQuery(query: string, item: { displayName: string; email: string | null }) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.displayName.toLowerCase().includes(q) || (item.email?.toLowerCase().includes(q) ?? false)
  );
}

export function AdminsShell({ data }: { data: AcademyAdminListData }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [justGranted, setJustGranted] = useState<{
    displayName: string;
    email: string;
    mode: "existing" | "invited";
    emailSent?: boolean;
    message?: string;
  } | null>(null);
  const hasAny =
    data.active.length > 0 || data.suspended.length > 0 || data.pendingInvites.length > 0;
  const canRevoke = data.activeCount > 1;

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

  const modal = modalOpen ? (
    <AddAdminModal
      onClose={() => setModalOpen(false)}
      onGranted={(details) => {
        setModalOpen(false);
        setJustGranted(details);
        router.refresh();
      }}
    />
  ) : null;

  if (justGranted) {
    return (
      <div>
        <AdminHeader
          title="Admins"
          description="Add Academy Admins by hand. There is no self-service Admin sign-up."
        />
        <div
          className="rounded-[12px] bg-surface px-6 py-8"
          style={{ border: "1px solid var(--border)" }}
        >
          <p className="text-[16px] font-semibold tracking-[-0.2px]">
            {justGranted.mode === "invited" ? "Invite sent" : "Admin added"}
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {justGranted.mode === "invited"
              ? `${justGranted.displayName} (${justGranted.email}) received a 24-hour setup link. When they accept, they become an Academy Admin.`
              : justGranted.emailSent === false
                ? `${justGranted.displayName}${justGranted.email ? ` (${justGranted.email})` : ""} now has Academy Admin access. ${justGranted.message || "The notification email could not be sent."}`
                : `${justGranted.displayName}${justGranted.email ? ` (${justGranted.email})` : ""} now has Academy Admin access.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setJustGranted(null);
                router.refresh();
              }}
            >
              Done
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setJustGranted(null);
                setModalOpen(true);
              }}
            >
              Add another
            </Button>
          </div>
        </div>
        {modal}
      </div>
    );
  }

  const addButton = (
    <Button variant="primary" onClick={() => setModalOpen(true)}>
      Add admin
    </Button>
  );

  if (!hasAny) {
    return (
      <>
        <AdminEmptyState onAdd={() => setModalOpen(true)} />
        {modal}
      </>
    );
  }

  return (
    <div>
      <AdminHeader
        title="Admins"
        description="Add Academy Admins by hand — existing accounts or new emails. There is no self-service Admin sign-up. The last active Admin cannot be removed."
        actions={addButton}
      />

      <div className="mb-5 max-w-md">
        <Input
          label="Search admins"
          name="admin-search"
          value={search}
          placeholder="Name or email"
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="space-y-6">
        {!hasMatches ? (
          <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            No admins match “{search.trim()}”.
          </p>
        ) : null}

        {filteredInvites.length > 0 ? (
          <PendingAdminInvitesTable invites={filteredInvites} />
        ) : null}

        {filteredActive.length > 0 ? (
          <AdminsTable title="Active admins" admins={filteredActive} canRevoke={canRevoke} />
        ) : null}

        {filteredSuspended.length > 0 ? (
          <AdminsTable title="Suspended" admins={filteredSuspended} canRevoke={false} />
        ) : null}

        {data.truncatedActive || data.truncatedSuspended ? (
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Showing the first 48 admins per status.
          </p>
        ) : null}
      </div>

      {modal}
    </div>
  );
}
