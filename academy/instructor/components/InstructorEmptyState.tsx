import { Button } from "@/base/components/Button";
import { EmptyState } from "@/academy/components/ui";

function AuthoringIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19.5V6a2 2 0 012-2h9l5 5v10.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 014 19.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 4v5h5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8.5 13h7M8.5 16.5h4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function InstructorEmptyState({ flush = false }: { flush?: boolean }) {
  return (
    <EmptyState
      icon={<AuthoringIcon />}
      flush={flush}
      compact={flush}
      title="No programs yet"
      body="Use Whitby above to generate a course from scratch, or start from a blank outline. It stays a draft until an Academy Admin approves it."
      actions={
        <Button href="/academy/instructor/programs/new" variant="secondary">
          Blank outline
        </Button>
      }
    />
  );
}
