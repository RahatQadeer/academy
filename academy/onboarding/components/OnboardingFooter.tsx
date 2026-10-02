import { Button } from "@/base/components/Button";

export function OnboardingFooter({
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  primaryDisabled,
}: {
  primaryLabel: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  primaryDisabled?: boolean;
}) {
  return (
    <div
      className={`mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center ${
        secondaryLabel ? "sm:justify-between" : "sm:justify-end"
      }`}
    >
      {secondaryLabel ? (
        <Button type="button" variant="ghost" onClick={onSecondary}>
          {secondaryLabel}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="primary"
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="min-h-10 w-full sm:w-auto sm:min-w-[10.5rem]"
      >
        {primaryLabel}
      </Button>
    </div>
  );
}
