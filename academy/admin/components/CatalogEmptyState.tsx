import { Button } from "@/base/components/Button";
import { EmptyState } from "@/academy/components/ui";

function CatalogIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function CatalogEmptyState({
  showWhitbyPrompt = false,
  allowCreate = true,
}: {
  showWhitbyPrompt?: boolean;
  allowCreate?: boolean;
}) {
  if (!allowCreate) {
    return (
      <EmptyState
        icon={<CatalogIcon />}
        flush
        title="No programs yet"
        body="Academy Admins and Instructors create programs. As Super Admin you manage people and access — not the catalog."
      />
    );
  }

  return (
    <EmptyState
      icon={<CatalogIcon />}
      flush
      title="No programs yet"
      body={
        showWhitbyPrompt
          ? "Use the Whitby builder above, or start from a blank outline and write it yourself."
          : "Start from a blank outline and build your first Academy program."
      }
      actions={
        <Button variant={showWhitbyPrompt ? "secondary" : "primary"} href="/academy/admin/catalog/new">
          New program
        </Button>
      }
    />
  );
}
