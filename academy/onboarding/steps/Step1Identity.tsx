import { StepIdentity } from "../components/StepIdentity";
import { OnboardingFooter } from "../components/OnboardingFooter";

export function Step1Identity({
  fullName,
  email,
  onContinue,
}: {
  fullName: string;
  email: string;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col">
      <StepIdentity fullName={fullName} email={email} />
      <OnboardingFooter primaryLabel="Continue" onPrimary={onContinue} />
    </div>
  );
}
