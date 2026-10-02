import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import type { AdminCredentialListItem } from "../types";
import { credentialKindLabel, formatCredentialDate } from "../lib/format";
import { CredentialsEmptyState } from "./CredentialsEmptyState";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  const time = Date.parse(expiresAt);
  return !Number.isNaN(time) && time < Date.now();
}

function expiryLabel(item: AdminCredentialListItem) {
  if (item.expiresAt) return formatCredentialDate(item.expiresAt);
  return "Does not expire";
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M5 3.5L8.5 7L5 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AwardedTable({
  items,
  heading = "Awarded",
  description = "Issued certificates across all three types. Timed awards expire when the program’s Certificate validity is set to 3 years. Open a row to verify or renew.",
  countLabel = "awarded",
}: {
  items: AdminCredentialListItem[];
  heading?: string;
  description?: string;
  countLabel?: string;
}) {
  return (
    <section aria-labelledby="awarded-credentials-heading">
      <div
        className="rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        <div
          className="flex flex-col gap-1 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <h2 id="awarded-credentials-heading" className="text-[16px] font-semibold tracking-[-0.2px]">
              {heading}
            </h2>
            <p className="mt-1 text-[13px] text-pretty" style={{ color: "var(--text-secondary)" }}>
              {description}
            </p>
          </div>
          <p className="shrink-0 text-[12.5px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            {items.length.toLocaleString()} {countLabel}
          </p>
        </div>

        {items.length === 0 ? (
          <CredentialsEmptyState kind="awarded" />
        ) : (
          <ul role="list">
            {items.map((item, index) => {
              const href = `/academy/admin/credentials/${item.id}`;
              const expired = isExpired(item.expiresAt);
              const isLast = index === items.length - 1;
              return (
                <li
                  key={item.id}
                  className={isLast ? undefined : "border-b"}
                  style={isLast ? undefined : { borderColor: "var(--border)" }}
                >
                  <Link
                    href={href}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-5 py-3.5 no-underline transition-colors hover:bg-surface-soft sm:gap-x-4 sm:px-6"
                    style={{ color: "var(--ink)" }}
                  >
                    <Avatar
                      name={item.learnerName}
                      size={36}
                      tone={index % 2 === 0 ? "tan" : "blue"}
                    />

                    <div className="min-w-0">
                      <p className="text-[14.5px] font-semibold leading-snug tracking-[-0.15px]">
                        {item.learnerName}
                      </p>
                      <p className="mt-1 text-[13.5px] leading-snug text-pretty">
                        {item.credentialName}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
                        <Pill tone="neutral">{credentialKindLabel(item.type)}</Pill>
                        <span className="text-[12.5px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                          Awarded {formatCredentialDate(item.awardedAt)}
                        </span>
                        {expired ? (
                          <Pill tone="danger">Expired {expiryLabel(item)}</Pill>
                        ) : item.expiresAt ? (
                          <Pill tone="warning">Expires {expiryLabel(item)}</Pill>
                        ) : (
                          <Pill tone="neutral">Does not expire</Pill>
                        )}
                      </div>
                    </div>

                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
                      style={{ color: "var(--text-tertiary)" }}
                      aria-hidden
                    >
                      <ChevronIcon />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
