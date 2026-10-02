"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { cn } from "@/base/lib/cn";
import { AdminPageHeader } from "@/super-admin/partner-center/components/AdminPageHeader";
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import { formatShortDate } from "@/super-admin/partner-center/lib/format";
import {
  invitePartnerAdminAction,
  revokePartnerAdminAction,
} from "@/super-admin/users/actions";
import type { PartnerAdminTab } from "@/super-admin/users/lib/parse-tab";

type Row = {
  id: string;
  email: string;
  status: string;
  invite_expires_at: string | null;
  invited_at: string;
  activated_at: string | null;
};

const TABS: { id: PartnerAdminTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "invited", label: "Invited" },
  { id: "revoked", label: "Revoked" },
];

function statusTone(
  status: string,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "invited") return "info";
  if (status === "revoked") return "danger";
  return "neutral";
}

function statusLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "invited") return "Invited";
  if (status === "revoked") return "Revoked";
  return status;
}

export function UsersAdminView({
  initialRows,
  activeTab,
}: {
  initialRows: Row[];
  activeTab: PartnerAdminTab;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const invitedCount = useMemo(
    () => initialRows.filter((row) => row.status === "invited").length,
    [initialRows],
  );

  const items = useMemo(() => {
    if (activeTab === "all") return initialRows;
    return initialRows.filter((row) => row.status === activeTab);
  }, [activeTab, initialRows]);

  return (
    <div>
      <AdminPageHeader
        title="Partner Admins"
        description="Invite and revoke staff who manage Partner Center."
        action={
          <Button
            type="button"
            variant="primary"
            unsized
            className="px-3.5 py-2 text-[13.5px]"
            onClick={() => {
              setShowInvite((open) => !open);
              setError(null);
            }}
          >
            {showInvite ? "Close invite" : "Invite Partner Admin"}
          </Button>
        }
      />

      {showInvite ? (
        <section className="pa-partner-card mb-5 px-5 py-5">
          <h2 className="m-0 text-[15px] font-semibold">Invite Partner Admin</h2>
          <p
            className="mt-1 text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            They get a link to set a password and land on Partner Admin — not
            partner onboarding.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              unsized
              className="px-3.5 py-2 text-[13.5px]"
              disabled={pending || !email.trim()}
              onClick={() => {
                setError(null);
                setInviteUrl(null);
                setEmailNote(null);
                setCopied(false);
                startTransition(async () => {
                  const result = await invitePartnerAdminAction({ email });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setInviteUrl(result.inviteUrl);
                  setEmailNote(
                    result.emailSent
                      ? "Invite email sent."
                      : `Email could not be sent${result.emailError ? `: ${result.emailError}` : ""}. Use the link below.`,
                  );
                  setEmail("");
                  router.refresh();
                });
              }}
            >
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </div>
          {error ? (
            <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
              {error}
            </p>
          ) : null}
          {emailNote ? (
            <p
              className="mt-3 text-[13px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {emailNote}
            </p>
          ) : null}
          {inviteUrl ? (
            <div
              className="mt-3 rounded-md border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">Copyable invite link</div>
                <Button
                  type="button"
                  variant="secondary"
                  unsized
                  className="px-3 py-1.5 text-[13px]"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteUrl);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
              <code className="mt-1 block break-all">{inviteUrl}</code>
            </div>
          ) : null}
        </section>
      ) : null}

      <div
        className="mb-5 flex flex-wrap gap-x-6 gap-y-2"
        style={{ borderBottom: "1px solid var(--border)" }}
        role="tablist"
      >
        {TABS.map((tab) => {
          const selected = tab.id === activeTab;
          const badge =
            tab.id === "invited" && invitedCount > 0 ? invitedCount : null;
          return (
            <Link
              key={tab.id}
              href={`/super-admin/users?tab=${tab.id}`}
              className={cn(
                "mb-[-1px] border-0 bg-transparent pb-3 text-[14px] no-underline",
              )}
              style={{
                fontWeight: selected ? 600 : 400,
                color: selected ? "var(--ink)" : "var(--text-tertiary)",
                borderBottom: selected
                  ? "2px solid var(--ink)"
                  : "2px solid transparent",
              }}
            >
              {tab.label}
              {badge != null ? (
                <span
                  className="ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold"
                  style={{
                    background: "var(--ink)",
                    color: "var(--surface)",
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {error && !showInvite ? (
        <p className="mb-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
          No Partner Admins in this view.
        </p>
      ) : (
        <div className="pa-partner-card overflow-hidden">
          <table className="w-full border-collapse text-left text-[13.5px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Email", "Status", "Invited", "Activated", "Actions"].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-[0.04em]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                  className="hover:bg-[#fafaf9]"
                >
                  <td
                    className="px-4 py-3 font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    {row.email}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusPill
                      label={statusLabel(row.status)}
                      tone={statusTone(row.status)}
                    />
                    {row.status === "invited" && row.invite_expires_at ? (
                      <div
                        className="mt-1 text-[12px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        Expires {formatShortDate(row.invite_expires_at)}
                      </div>
                    ) : null}
                  </td>
                  <td
                    className="px-4 py-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatShortDate(row.invited_at)}
                  </td>
                  <td
                    className="px-4 py-3"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {row.activated_at
                      ? formatShortDate(row.activated_at)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.status !== "revoked" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        unsized
                        className="px-3 py-1.5 text-[13px]"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          startTransition(async () => {
                            const result = await revokePartnerAdminAction({
                              email: row.email,
                            });
                            if (!result.ok) {
                              setError(result.error);
                              return;
                            }
                            router.refresh();
                          });
                        }}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
