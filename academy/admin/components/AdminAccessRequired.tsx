import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";

/**
 * Shown when a signed-in person reaches an admin surface without the
 * Academy Admin role. Says who can grant it and offers a way back.
 */
export function AdminAccessRequired() {
  return (
    <Callout tone="warning" title="Admin access required">
      <p>
        This area is limited to Academy Admins. Ask a Private Attaché administrator if you need
        access.
      </p>
      <div className="mt-3">
        <Button href="/academy" variant="secondary">
          Back to Academy
        </Button>
      </div>
    </Callout>
  );
}
