"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { TeamModal } from "@/partner-center/team/components/TeamModal";
import { removeTeamMember } from "@/partner-center/team/lib/actions";
import type { TeamMemberRow } from "@/partner-center/team/types";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

export function RemoveMemberConfirm({
  member,
  onClose,
  onRemoved,
}: {
  member: TeamMemberRow;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onRemove() {
    setPending(true);
    setError(null);
    const result = await runAction(
      () => removeTeamMember({ member_id: member.id }),
      { onValidationError: setError, onRetry: () => void onRemove() },
    );
    setPending(false);
    if (result.error) return;
    router.refresh();
    onRemoved();
  }

  return (
    <TeamModal
      title={`Remove ${member.name} from team?`}
      description="They lose Partner Center access immediately. Contact functions assigned to them will need to be reassigned."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="!bg-[var(--danger-fg)] hover:!opacity-90"
            onClick={() => void onRemove()}
            disabled={pending}
          >
            {pending ? "Removing…" : "Remove from team"}
          </Button>
        </>
      }
    >
      <FormError message={error} />
    </TeamModal>
  );
}
