import { Avatar } from "@/base/components/Avatar";
import { Button } from "@/base/components/Button";
import { ProgressBar } from "@/base/components/ProgressBar";
import type { ChecklistItem } from "@/partner-center/lib/checklist-state";
import { SetupCanvas } from "@/partner-center/onboarding/components/ChecklistNavBar";
import { ChecklistRow } from "@/partner-center/onboarding/components/ChecklistRow";
import { ActivatePartnerButton } from "@/partner-center/onboarding/components/ActivatePartnerButton";

export function OnboardingChecklist({
  companyName,
  avatarName,
  items,
  doneCount,
  total,
  firstOpenId,
}: {
  companyName: string;
  avatarName: string;
  items: ChecklistItem[];
  doneCount: number;
  total: number;
  firstOpenId: string | null;
}) {
  const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return (
    <SetupCanvas
      wide
      navRight={<Avatar name={avatarName} size={32} />}
    >
      <p
        className="text-[11.5px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Welcome, {companyName}
      </p>
      <h1 className="mb-2 mt-2 text-[24px] font-bold tracking-[-0.4px] text-pretty">
        Finish setting up your Partner Center
      </h1>
      <p
        className="mb-4 text-[13.5px] leading-[1.55]"
        style={{ color: "var(--text-secondary)" }}
      >
        {doneCount} of {total} steps complete. Your referral link unlocks after
        the other steps — then you can start sharing.
      </p>
      <div className="mb-6">
        <ProgressBar value={progress} />
      </div>
      <div
        className="overflow-hidden rounded-[10px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        {items.map((item, index) => (
          <ChecklistRow
            key={item.id}
            item={item}
            current={item.id === firstOpenId}
            last={index === items.length - 1}
          />
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between gap-4">
        {doneCount === total ? (
          <ActivatePartnerButton
            label="Open Partner Center"
            variant="primary"
          />
        ) : (
          <>
            <span />
            <Button
              type="button"
              variant="secondary"
              disabled
              className="text-[13.5px]"
              aria-label="Skip for now — finish setup first"
            >
              Skip for now, go to Partner Center →
            </Button>
          </>
        )}
      </div>
    </SetupCanvas>
  );
}

export function SetupHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <h1 className="mb-1.5 text-[24px] font-bold tracking-[-0.4px]">{title}</h1>
      <p
        className="mb-6 text-[14px] leading-[1.5]"
        style={{ color: "var(--text-secondary)" }}
      >
        {description}
      </p>
    </>
  );
}
