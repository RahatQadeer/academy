import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import type { CredentialItem } from "../types";
import { credentialStatusTone, formatCredentialDate } from "../utils/labels";
import { credentialStatusChip, credentialSubtitle } from "../utils/presentation";

function markStyle(item: CredentialItem) {
  if (item.status === "awarded") {
    return { background: "var(--success-bg)", color: "var(--success-fg)" };
  }
  if (item.type === "cpa_credential") {
    return { background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" };
  }
  if (item.type === "specialty_endorsement") {
    return { background: "var(--accent-tint)", color: "var(--accent)" };
  }
  return { background: "var(--module-whitby-bg)", color: "var(--module-whitby-fg)" };
}

function markLabel(item: CredentialItem) {
  if (item.type === "cpa_credential") return "CPA";
  if (item.type === "specialty_endorsement") return "SE";
  return "CC";
}

export function CredentialCard({ item }: { item: CredentialItem }) {
  const awarded = item.status === "awarded";
  const detailHref = `/academy/credentials/${item.id}`;

  return (
    <article className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-semibold"
        style={markStyle(item)}
        aria-hidden
      >
        {awarded ? (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path
              d="M3.5 8.2 6.6 11.2 12.5 4.8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          markLabel(item)
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.15px] text-pretty">
          <Link href={detailHref} className="text-ink no-underline hover:text-accent">
            {item.programName}
          </Link>
        </h3>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {awarded && item.awardedAt
            ? `Awarded ${formatCredentialDate(item.awardedAt)}`
            : credentialSubtitle(item)}
          {item.expiresAt && awarded ? ` · Expires ${formatCredentialDate(item.expiresAt)}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:justify-end">
        <Pill tone={item.status === "awarded" ? "success" : item.certificateLocked ? "warning" : credentialStatusTone(item.status)}>
          {credentialStatusChip(item.status, item.certificateLocked)}
        </Pill>
        {awarded ? (
          <Button href={detailHref} variant="secondary" className="!px-3.5 !py-1.5 !text-[13px]">
            View certificate
          </Button>
        ) : (
          <Link
            href={detailHref}
            className="text-[13px] font-medium no-underline hover:text-accent-hover"
            style={{ color: "var(--accent)" }}
          >
            Continue
          </Link>
        )}
      </div>
    </article>
  );
}
