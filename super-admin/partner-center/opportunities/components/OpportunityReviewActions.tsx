"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { updateOpportunityStatusAction } from "@/super-admin/partner-center/actions";
import { partnerAdminUpdateOpportunityStatusAction } from "@/partner-center/admin/lib/actions";
import { AdminActionBar } from "@/super-admin/partner-center/components/AdminDetailSections";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";

export function OpportunityReviewActions({
  opportunityId,
  status,
  partnerProfileId,
  staffKind = "super",
}: {
  opportunityId: string;
  status: string;
  partnerProfileId: string;
  staffKind?: "super" | "partner";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const key = status.toLowerCase();
  const isClosed = key === "converted" || key === "not_moving_forward";
  const partnerHref =
    staffKind === "partner"
      ? PA_ADMIN.partner(partnerProfileId)
      : PC_ADMIN.partner(partnerProfileId);
  const updateStatus =
    staffKind === "partner"
      ? partnerAdminUpdateOpportunityStatusAction
      : updateOpportunityStatusAction;

  function run(action: "accept" | "in_progress" | "converted" | "not_moving_forward") {
    setError(null);
    startTransition(async () => {
      const result = await updateStatus({
        opportunityId,
        action,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <AdminActionBar>
        <Button
          type="button"
          variant="primary"
          disabled={pending || isClosed || key !== "submitted"}
          onClick={() => run("accept")}
        >
          Accept opportunity
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || isClosed || key !== "accepted"}
          onClick={() => run("in_progress")}
        >
          Mark in progress
        </Button>
        {staffKind === "super" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={
              pending || isClosed || (key !== "accepted" && key !== "in_progress")
            }
            onClick={() => run("converted")}
          >
            Mark converted
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={pending || isClosed}
          onClick={() => run("not_moving_forward")}
        >
          Close
        </Button>
        <Link href={partnerHref}>
          <Button type="button" variant="secondary">
            View partner
          </Button>
        </Link>
      </AdminActionBar>
      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "#a8433b" }}>
          {error}
        </p>
      ) : null}
    </>
  );
}
