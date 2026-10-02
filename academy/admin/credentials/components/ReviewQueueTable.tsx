import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import { credentialStatusLabel, credentialStatusTone } from "@/academy/credentials/utils/labels";
import type { AdminCredentialListItem } from "../types";
import { credentialKindLabel } from "../lib/format";
import { CredentialsEmptyState } from "./CredentialsEmptyState";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

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

export function ReviewQueueTable({ items }: { items: AdminCredentialListItem[] }) {
  return (
    <section aria-labelledby="credential-review-heading">
      <div
        className="overflow-hidden rounded-[12px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        <div
          className="flex flex-col gap-1 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <h2 id="credential-review-heading" className="text-[16px] font-semibold tracking-[-0.2px]">
              Pending certificate review
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
              Learners who requested a certificate appear first. Open a row to award or return.
            </p>
          </div>
          <p className="shrink-0 text-[12.5px] font-medium tabular-nums" style={{ color: "var(--text-tertiary)" }}>
            {items.length.toLocaleString()} in review
          </p>
        </div>

        {items.length === 0 ? (
          <CredentialsEmptyState kind="review" />
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full min-w-[760px] table-fixed border-collapse text-left text-[13.5px]"
              style={{ color: "var(--ink)" }}
            >
              <caption className="sr-only">Credentials waiting on admin review.</caption>
              <colgroup>
                <col style={{ width: "28%" }} />
                <col style={{ width: "40%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr
                  className="border-b text-[11px] font-semibold uppercase tracking-[0.06em]"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-tertiary)",
                    background: "var(--surface-soft)",
                  }}
                >
                  <th scope="col" className="px-5 py-3 font-semibold sm:px-6">
                    Learner
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Credential
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Stage
                  </th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">
                    <span className="sr-only">Review</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const href = `/academy/admin/credentials/${item.id}`;
                  return (
                    <tr
                      key={item.id}
                      className="border-b align-middle transition-colors last:border-b-0 hover:bg-surface-soft"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <th scope="row" className="px-5 py-3.5 text-left font-medium sm:px-6">
                        <Link
                          href={href}
                          className="flex items-center gap-3 text-ink no-underline transition-colors hover:text-accent"
                        >
                          <Avatar
                            name={item.learnerName}
                            size={36}
                            tone={index % 2 === 0 ? "tan" : "blue"}
                          />
                          <span className="truncate leading-snug">{item.learnerName}</span>
                        </Link>
                      </th>
                      <td className="px-4 py-3.5">
                        <Link
                          href={href}
                          className="block leading-snug text-ink no-underline hover:text-accent"
                        >
                          {item.credentialName}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Pill tone="neutral">{credentialKindLabel(item.type)}</Pill>
                          {item.certificateRequestedAt ? (
                            <Pill tone="accent">Learner requested</Pill>
                          ) : item.status === "credential_review" ? (
                            <Pill tone="warning">Awaiting request</Pill>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <Pill tone={credentialStatusTone(item.status)}>
                          {credentialStatusLabel(item.status)}
                        </Pill>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <Link
                          href={href}
                          aria-label={`Review ${item.learnerName}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] no-underline transition-colors hover:bg-[color:var(--accent-tint)] hover:text-accent"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          <ChevronIcon />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
