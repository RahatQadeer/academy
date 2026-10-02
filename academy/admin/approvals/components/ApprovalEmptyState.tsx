import { Button } from "@/base/components/Button";
import { EmptyState } from "@/academy/components/ui";
import type { QueueStatusFilter } from "../../types";

function QueueIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 7.5h10M7 12h10M7 16.5h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ApprovalEmptyState({ filter }: { filter: QueueStatusFilter }) {
  const title =
    filter === "pending"
      ? "No requests need review"
      : filter === "ready"
        ? "Nothing waiting to publish"
        : filter === "published"
          ? "No published requests yet"
          : "No returned requests";
  const body =
    filter === "pending"
      ? "When an instructor asks to publish a program, the request appears here for your decision."
      : filter === "ready"
        ? "After you approve a request, it waits here until you or the instructor publish it to Explore."
        : filter === "published"
          ? "Completed approvals that went live show here so you can revisit past decisions."
          : "Requests you return for edits are kept here. They come back under Needs review when the instructor submits again.";

  return (
    <EmptyState
      flush
      icon={<QueueIcon />}
      title={title}
      body={body}
      actions={
        filter !== "pending" ? (
          <Button href="/academy/admin/approvals" variant="secondary">
            View needs review
          </Button>
        ) : undefined
      }
    />
  );
}
