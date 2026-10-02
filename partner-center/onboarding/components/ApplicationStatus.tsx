import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { Pill } from "@/base/components/Pill";
import { StatusCanvas } from "@/partner-center/onboarding/components/StatusScreen";
import type { PartnerProfileStatus } from "@/partner-center/types/partner";

const STAGES = ["Application submitted", "Under review", "Agreement", "Active"];

const COPY: Record<
  string,
  { pill: string; title: string; note: string; reached: number }
> = {
  applied: {
    pill: "Under Review",
    title: "Your application is under review",
    note: "We'll email you as soon as there's an update.",
    reached: 1,
  },
  under_review: {
    pill: "Under Review",
    title: "Your application is under review",
    note: "We'll email you as soon as there's an update.",
    reached: 1,
  },
  approved: {
    pill: "Approved",
    title: "Your application is approved",
    note: "We'll email you when your partner agreement is ready to sign.",
    reached: 2,
  },
  active: {
    pill: "Active",
    title: "Your partner account is active",
    note: "Partner Center is unlocked for this account.",
    reached: 4,
  },
};

function StageRow({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-[9px]">
      <span
        className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
        style={
          done
            ? { background: "var(--success-bg)", color: "var(--success-fg)" }
            : {
                border: `1px solid ${active ? "var(--border-strong)" : "var(--border)"}`,
              }
        }
      >
        {done ? (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6.2L4.6 8.8L10 3.2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span
        className={cn("text-[13.5px]", active || done ? "font-medium" : "")}
        style={{ color: active || done ? "var(--ink)" : "var(--text-tertiary)" }}
      >
        {label}
      </span>
    </div>
  );
}

export function ApplicationStatus({
  status,
  reference,
  companyName,
}: {
  status: PartnerProfileStatus | undefined;
  reference: string | null;
  companyName: string | null;
}) {
  const copy = COPY[status ?? "applied"] ?? COPY.applied;
  const subject = [reference && `Application ${reference}`, companyName && `for ${companyName}`]
    .filter(Boolean)
    .join(" ");

  return (
    <StatusCanvas>
      <Pill tone="info">{copy.pill}</Pill>
      <h1 className="mb-1.5 mt-3 text-[20px] font-bold tracking-[-0.3px]">
        {copy.title}
      </h1>
      <p
        className="text-[13.5px] leading-[1.55]"
        style={{ color: "var(--text-secondary)" }}
      >
        {subject ? `${subject}. ` : null}
        {copy.note}
      </p>
      <div className="mt-6">
        {STAGES.map((label, index) => (
          <StageRow
            key={label}
            label={label}
            done={index < copy.reached}
            active={index === copy.reached}
          />
        ))}
      </div>
      <Link
        href="/switcher"
        className="mt-6 inline-block text-[13px] no-underline hover:underline"
        style={{ color: "var(--text-tertiary)" }}
      >
        Back to switcher
      </Link>
    </StatusCanvas>
  );
}
