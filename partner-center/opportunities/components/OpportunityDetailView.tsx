import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import {
  contactDetailLabel,
  estimatedSizeLabel,
  formatMoney,
  productInterestLabel,
  statusLabel,
  statusTone,
} from "@/partner-center/opportunities/lib/format";
import { protectionDaysLabel } from "@/partner-center/opportunities/lib/can-mutate";
import type { OpportunityDetail } from "@/partner-center/opportunities/types";

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`pa-partner-card p-6 ${className ?? ""}`}>
      <div
        className="mb-4 text-[14px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="mb-1 text-[12.5px] leading-none"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>
      <div
        className="text-[14px] leading-[1.4]"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}

export function OpportunityDetailView({
  data,
  canEdit = false,
}: {
  data: OpportunityDetail;
  canEdit?: boolean;
}) {
  const showEdit = canEdit && data.editable;
  const protectionCopy = protectionDaysLabel(
    data.acceptedAt,
    data.protectedUntil,
  );

  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome
        title={data.companyName}
        action={
          showEdit ? (
            <Button
              href={`/partner-center/opportunities/${data.id}/edit`}
              variant="secondary"
            >
              Edit
            </Button>
          ) : undefined
        }
      />
      <Link
        href="/partner-center/opportunities"
        className="mb-6 inline-flex w-fit text-[13.5px] no-underline hover:underline"
        style={{ color: "var(--text-secondary)" }}
      >
        ← Back to Opportunities
      </Link>

      <div className="mb-6">
        <Pill tone={statusTone(data.status)}>
          {statusLabel(data.status)}
        </Pill>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.85fr)]">
        <div className="flex flex-col gap-5">
          <Card title="Opportunity details">
            <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
              <DetailRow
                label="Primary contact"
                value={contactDetailLabel(
                  data.contactName,
                  data.contactTitle,
                )}
              />
              <DetailRow label="Email" value={data.contactEmail || "—"} />
              <DetailRow label="Phone" value={data.contactPhone || "—"} />
              <DetailRow label="Website" value={data.website || "—"} />
              <DetailRow
                label="Product interest"
                value={productInterestLabel(
                  data.productInterest,
                  data.productInterestOptions,
                )}
              />
              <DetailRow
                label="Estimated size"
                value={estimatedSizeLabel(
                  data.estimatedSeats,
                  data.productInterest,
                )}
              />
              {data.estimatedValue != null ? (
                <DetailRow
                  label="Estimated value"
                  value={formatMoney(data.estimatedValue)}
                />
              ) : null}
              {data.expectedTiming ? (
                <DetailRow
                  label="Expected timing"
                  value={data.expectedTiming}
                />
              ) : null}
              <DetailRow label="Submitted" value={data.submittedLabel} />
              {data.attachment ? (
                <div>
                  <div
                    className="mb-1 text-[12.5px] leading-none"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Attachment
                  </div>
                  <a
                    href={`/partner-center/opportunities/${data.id}/attachment`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] leading-[1.4] underline-offset-2 hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {data.attachment.title}
                  </a>
                </div>
              ) : null}
            </div>
            {data.additionalContext ? (
              <div
                className="mt-6 border-t pt-5"
                style={{ borderColor: "var(--border)" }}
              >
                <div
                  className="mb-1.5 text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Additional context
                </div>
                <p
                  className="m-0 whitespace-pre-wrap text-[14px] leading-[1.55]"
                  style={{ color: "var(--ink)" }}
                >
                  {data.additionalContext}
                </p>
              </div>
            ) : null}
          </Card>

          <Card title="Timeline">
            <ul className="m-0 list-none p-0">
              {data.timeline.map((item, index) => (
                <li
                  key={item.id}
                  className="flex gap-6 py-3.5 first:pt-0 last:pb-0"
                  style={
                    index < data.timeline.length - 1
                      ? { borderBottom: "1px solid var(--border)" }
                      : undefined
                  }
                >
                  <div
                    className="w-[108px] shrink-0 text-[13px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {item.dateLabel}
                  </div>
                  <div
                    className="min-w-0 text-[13.5px] leading-[1.45]"
                    style={{ color: "var(--ink)" }}
                  >
                    {item.parts.map((part, partIndex) =>
                      part.bold ? (
                        <strong key={partIndex} className="font-semibold">
                          {part.text}
                        </strong>
                      ) : (
                        <span key={partIndex}>{part.text}</span>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div>
          <Card title="Protection">
            <div className="space-y-4">
              <DetailRow
                label="Accepted"
                value={data.acceptedLabel || "—"}
              />
              <DetailRow
                label="Protected through"
                value={data.protectedUntilLabel || "—"}
              />
              <p
                className="m-0 border-t pt-4 text-[12.5px] leading-[1.5]"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-tertiary)",
                }}
              >
                Attribution for this opportunity is held for{" "}
                {protectionCopy} from acceptance, independent of the standard
                90-day referral window.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
