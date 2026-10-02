"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import {
  DEFAULT_DECLINE_REASON,
  DEFAULT_INFO_REQUEST_MESSAGE,
} from "@/partner-center/lib/review-state";
import type { PartnerProgramFamily } from "@/partner-center/types/application";
import {
  approveApplicationAction,
  declineApplicationAction,
  requestApplicationInfoAction,
} from "@/super-admin/partner-center/actions";
import {
  partnerAdminApproveApplicationAction,
  partnerAdminDeclineApplicationAction,
  partnerAdminRequestApplicationInfoAction,
} from "@/partner-center/admin/lib/actions";
import { AdminActionBar } from "@/super-admin/partner-center/components/AdminDetailSections";
import {
  AdminModal,
  AdminModalCancelButton,
} from "@/super-admin/partner-center/components/AdminModal";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";
import { isApplicationQueueStatus } from "@/super-admin/partner-center/lib/format";

export function ApplicationReviewActions({
  profileId,
  status,
  defaultPrograms,
  staffKind = "super",
}: {
  profileId: string;
  status: string;
  defaultPrograms: PartnerProgramFamily[];
  staffKind?: "super" | "partner";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState(DEFAULT_DECLINE_REASON);
  const [infoMessage, setInfoMessage] = useState(DEFAULT_INFO_REQUEST_MESSAGE);

  const canReview = isApplicationQueueStatus(status);
  const partnerHref =
    staffKind === "partner"
      ? PA_ADMIN.partner(profileId)
      : PC_ADMIN.partner(profileId);
  const approve =
    staffKind === "partner"
      ? partnerAdminApproveApplicationAction
      : approveApplicationAction;
  const decline =
    staffKind === "partner"
      ? partnerAdminDeclineApplicationAction
      : declineApplicationAction;
  const requestInfo =
    staffKind === "partner"
      ? partnerAdminRequestApplicationInfoAction
      : requestApplicationInfoAction;

  function run(action: () => Promise<{ error?: string; ok?: boolean }>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      onDone?.();
      router.refresh();
    });
  }

  return (
    <>
      <AdminActionBar>
        <Button
          type="button"
          variant="primary"
          disabled={!canReview || pending}
          onClick={() =>
            run(() =>
              approve({
                profileId,
                programs: defaultPrograms,
              }),
            )
          }
        >
          {pending && !declineOpen && !infoOpen ? "Approving…" : "Approve"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!canReview || pending}
          onClick={() => setInfoOpen(true)}
        >
          Request more info
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!canReview || pending}
          onClick={() => setDeclineOpen(true)}
        >
          Decline
        </Button>
        {(status === "approved" || status === "active") && (
          <Link href={partnerHref}>
            <Button type="button" variant="secondary">
              View partner
            </Button>
          </Link>
        )}
      </AdminActionBar>

      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "#a8433b" }}>
          {error}
        </p>
      ) : null}

      {declineOpen ? (
        <AdminModal
          title="Decline application"
          pending={pending}
          onClose={() => !pending && setDeclineOpen(false)}
          footer={
            <>
              <AdminModalCancelButton
                pending={pending}
                onClose={() => setDeclineOpen(false)}
              />
              <button
                type="button"
                disabled={pending || !declineReason.trim()}
                onClick={() =>
                  run(
                    () =>
                      decline({
                        profileId,
                        reason: declineReason,
                      }),
                    () => setDeclineOpen(false),
                  )
                }
                className="rounded-[6px] px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "#a8433b" }}
              >
                {pending ? "Declining…" : "Decline"}
              </button>
            </>
          }
        >
          <label className="block">
            <span
              className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Reason shown to applicant
            </span>
            <textarea
              value={declineReason}
              onChange={(event) => setDeclineReason(event.target.value)}
              rows={4}
              className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink"
            />
          </label>
        </AdminModal>
      ) : null}

      {infoOpen ? (
        <AdminModal
          title="Request more information"
          pending={pending}
          onClose={() => !pending && setInfoOpen(false)}
          footer={
            <>
              <AdminModalCancelButton
                pending={pending}
                onClose={() => setInfoOpen(false)}
              />
              <button
                type="button"
                disabled={pending || !infoMessage.trim()}
                onClick={() =>
                  run(
                    () =>
                      requestInfo({
                        profileId,
                        message: infoMessage,
                      }),
                    () => setInfoOpen(false),
                  )
                }
                className="rounded-[6px] px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: "var(--ink)" }}
              >
                {pending ? "Sending…" : "Send request"}
              </button>
            </>
          }
        >
          <label className="block">
            <span
              className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Message to applicant
            </span>
            <textarea
              value={infoMessage}
              onChange={(event) => setInfoMessage(event.target.value)}
              rows={5}
              placeholder="Describe what they need to clarify or correct…"
              className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink"
            />
          </label>
        </AdminModal>
      ) : null}
    </>
  );
}
