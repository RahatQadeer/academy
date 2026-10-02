import { Button } from "@/base/components/Button";
import { EmptyState } from "@/academy/components/ui";

function AdminsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 19.2c.8-3 3.4-5 7.5-5s6.7 2 7.5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={<AdminsIcon />}
      title="No admins yet"
      body="Academy Admins are added by the Super Admin. Invite an existing user or a new email — there is no self-service Admin sign-up."
      actions={
        <Button variant="primary" onClick={onAdd}>
          Add admin
        </Button>
      }
    />
  );
}
