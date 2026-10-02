import { InterestSelector } from "../components/InterestSelector";
import { OnboardingFooter } from "../components/OnboardingFooter";
import type { AcademyInterestId } from "../lib/interests";

export function Step2Interests({
  selected,
  onToggle,
  onContinue,
  onSkip,
}: {
  selected: AcademyInterestId[];
  onToggle: (id: AcademyInterestId) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col">
      <p
        className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--accent)" }}
      >
        Step 2
      </p>
      <h1 className="text-[26px] font-bold tracking-[-0.45px] text-pretty text-ink sm:text-[28px]">
        What are you here for?
      </h1>
      <p
        className="mt-1.5 mb-4 max-w-[36rem] text-[14px] leading-relaxed text-pretty"
        style={{ color: "var(--text-secondary)" }}
      >
        Pick as many as apply. This only shapes recommendations — never what you can
        access or earn.
      </p>
      <InterestSelector selected={selected} onToggle={onToggle} />
      <OnboardingFooter
        primaryLabel="Continue"
        onPrimary={onContinue}
        secondaryLabel="Skip for now"
        onSecondary={onSkip}
      />
    </div>
  );
}
