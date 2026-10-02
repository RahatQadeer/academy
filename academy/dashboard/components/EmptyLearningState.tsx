import { Button } from "@/base/components/Button";
import { EmptyState } from "@/academy/components/ui";

function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5.5A1.5 1.5 0 015.5 4H10a2 2 0 012 2v13a2 2 0 00-2-2H5.5A1.5 1.5 0 014 15.5v-10z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M20 5.5A1.5 1.5 0 0018.5 4H14a2 2 0 00-2 2v13a2 2 0 012-2h4.5a1.5 1.5 0 001.5-1.5v-10z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyLearningState() {
  return (
    <EmptyState
      compact
      icon={<BookIcon />}
      title="Nothing in progress"
      body="Browse Explore to enroll and start learning."
      actions={
        <Button href="/academy/explore" variant="primary">
          Explore
        </Button>
      }
    />
  );
}
