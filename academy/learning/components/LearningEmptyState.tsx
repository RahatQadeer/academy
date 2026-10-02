import { Button } from "@/base/components/Button";
import { EmptyState } from "@/academy/components/ui";

function PathIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.5 6H14a4 4 0 010 8h-4a4 4 0 000 8h5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LearningEmptyState() {
  return (
    <EmptyState
      icon={<PathIcon />}
      title="You haven't started any learning yet"
      body="Enroll in a published program from Explore and it will appear here with your progress."
      actions={
        <Button href="/academy/explore" variant="primary">
          Browse Explore
        </Button>
      }
    />
  );
}
