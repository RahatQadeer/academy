import { OnboardingFooter } from "../components/OnboardingFooter";

export function Step3Ready({
  firstName,
  onComplete,
}: {
  firstName: string;
  onComplete: () => void;
}) {
  return (
    <div className="flex flex-col">
      <p
        className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--accent)" }}
      >
        Step 3
      </p>
      <div className="flex items-start gap-3.5">
        <span
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-[17px] font-bold"
          style={{
            background: "var(--accent-tint)",
            color: "var(--accent)",
          }}
          aria-hidden
        >
          A
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold tracking-[-0.45px] text-pretty text-ink sm:text-[28px]">
            {firstName ? `You're ready, ${firstName}` : "You're ready"}
          </h1>
          <p
            className="mt-1.5 max-w-[36rem] text-[14px] leading-relaxed text-pretty"
            style={{ color: "var(--text-secondary)" }}
          >
            Explore, learn, and collect certificates — Completion, Specialty Endorsement,
            or Professional Credential.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
        <InfoCard mark="01" title="Explore" body="Browse programs for you." />
        <InfoCard mark="02" title="My Learning" body="Track every program." />
        <InfoCard mark="03" title="Certificates" body="View and share awards." />
      </div>

      <OnboardingFooter primaryLabel="Enter the Academy" onPrimary={onComplete} />
    </div>
  );
}

function InfoCard({
  mark,
  title,
  body,
}: {
  mark: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-[12px] p-3.5"
      style={{
        border: "1px solid var(--border)",
        background: "var(--accent-tint-soft)",
      }}
    >
      <p className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--accent)" }}>
        {mark}
      </p>
      <div className="mt-1.5 text-[14px] font-semibold text-ink">{title}</div>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-pretty" style={{ color: "var(--text-tertiary)" }}>
        {body}
      </p>
    </div>
  );
}
