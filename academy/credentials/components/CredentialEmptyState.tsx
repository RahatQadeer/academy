import { Button } from "@/base/components/Button";
import { EmptyState } from "@/academy/components/ui";

function SealIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9.5" r="5.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.5 14.5L7 22l5-2.5L17 22l-1.5-7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CredentialEmptyState() {
  return (
    <EmptyState
      icon={<SealIcon />}
      title="No credentials on file yet"
      body="Credentials and certificates appear here as you progress through Academy programs."
      actions={
        <>
          <Button href="/academy/learning" variant="primary">
            My Learning
          </Button>
          <Button href="/academy/explore" variant="secondary">
            Explore
          </Button>
        </>
      }
    />
  );
}
