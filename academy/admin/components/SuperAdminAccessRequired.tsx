import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";

/**
 * Signed-in Academy Admin (or other) reached a Super-Admin-only surface.
 */
export function SuperAdminAccessRequired() {
  return (
    <Callout tone="warning" title="Super Admin access required">
      <p>
        This area is limited to Academy Super Admins. Your Admin role cannot perform these
        privileged actions.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button href="/academy/admin" variant="secondary">
          Back to Admin dashboard
        </Button>
      </div>
    </Callout>
  );
}
