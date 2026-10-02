import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import { programStatusLabel } from "@/academy/instructor/utils/labels";
import type { ApprovalQueueItem } from "../../types";
import { approvalSubmissionMeta, approvalSubmissionTitle } from "../utils/labels";
import { ApprovalRequestStatus } from "./ApprovalRequestStatus";

function programStatusTone(status: ApprovalQueueItem["programStatus"]) {
  switch (status) {
    case "published":
      return "success" as const;
    case "pending_approval":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function ApprovalRequestCard({
  item,
  avatarTone = "tan",
}: {
  item: ApprovalQueueItem;
  avatarTone?: "tan" | "blue";
}) {
  const href = `/academy/admin/approvals/${item.id}`;

  return (
    <article
      className="rounded-[12px] border border-line bg-surface transition-[box-shadow,border-color] hover:border-line-strong hover:shadow-[0_2px_12px_rgba(15,15,15,0.06)]"
    >
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="flex min-w-0 items-start gap-3.5">
          <Avatar name={item.submittedByName} size={44} tone={avatarTone} />
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.15px] text-pretty">
              <Link href={href} className="text-ink no-underline hover:text-accent">
                {approvalSubmissionTitle(item)}
              </Link>
            </h3>
            <p
              className="mt-1.5 text-[13px] leading-relaxed text-pretty"
              style={{ color: "var(--text-secondary)" }}
            >
              {approvalSubmissionMeta(item)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone={programStatusTone(item.programStatus)}>
                {programStatusLabel(item.programStatus)}
              </Pill>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center sm:gap-2.5">
          <ApprovalRequestStatus status={item.status} />
          <Link
            href={href}
            className="text-[13.5px] font-semibold no-underline hover:text-accent-hover"
            style={{ color: "var(--accent)" }}
          >
            Review →
          </Link>
        </div>
      </div>
    </article>
  );
}
