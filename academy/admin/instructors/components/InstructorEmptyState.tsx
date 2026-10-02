import { Button } from "@/base/components/Button";
import { EmptyState } from "@/academy/components/ui";

function InstructorsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 17.5V8.2L12 5l8 3.2v9.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 10.5V19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function InstructorEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={<InstructorsIcon />}
      title="No instructors yet"
      body="Instructor accounts are added by an Admin. Add one and scope them to specific programs — there is no self-service sign-up."
      actions={
        <Button variant="primary" onClick={onAdd}>
          Add instructor
        </Button>
      }
    />
  );
}
