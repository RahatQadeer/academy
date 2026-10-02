"use client";

import { Button } from "@/base/components/Button";
import { TeamModal } from "@/partner-center/team/components/TeamModal";

export function StaffUpdatePlaceholder({ onClose }: { onClose: () => void }) {
  return (
    <TeamModal
      title="Update document"
      description="This file was shared by Private Attaché."
      onClose={onClose}
      footer={
        <Button type="button" variant="primary" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <p
        className="m-0 text-[13.5px] leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        Ask Private Attaché if you need a newer version of a staff-shared file.
      </p>
    </TeamModal>
  );
}
