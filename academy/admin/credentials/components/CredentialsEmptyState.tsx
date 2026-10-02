import { EmptyState } from "@/academy/components/ui";

function ReviewIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.5 9h7M8.5 12.5h7M8.5 16h4.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AwardedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="4.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.2 13.4L6.5 20l5.5-2.4L17.5 20l-1.7-6.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CredentialsEmptyState({ kind }: { kind: "review" | "awarded" }) {
  if (kind === "awarded") {
    return (
      <EmptyState
        flush
        compact
        icon={<AwardedIcon />}
        title="No awarded credentials"
        body="CPA credentials, endorsements, and certificates of completion appear here after they are issued."
      />
    );
  }

  return (
    <EmptyState
      flush
      compact
      icon={<ReviewIcon />}
      title="Nothing waiting for review"
      body="When a learner clicks Request certificate, they appear here with a Learner requested badge. Open the row to award or return."
    />
  );
}
