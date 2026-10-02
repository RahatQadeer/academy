import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import {
  earningStatusTone,
  formatMoney,
  statusLabel,
  statusTone,
} from "@/partner-center/referrals/lib/format";
import type { ReferralDetail } from "@/partner-center/referrals/types";

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
        className="mb-4 text-[13.5px] font-semibold"
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
        className="mb-0.5 text-[12.5px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>
      <div className="text-[14px]" style={{ color: "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

export function ReferralDetailView({ data }: { data: ReferralDetail }) {
  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome title={data.title} subtitle={data.displayId} />
      <Link
        href="/partner-center/referrals"
        className="mb-5 inline-flex w-fit text-[13.5px] no-underline"
        style={{ color: "var(--text-secondary)" }}
      >
        ← Back to Referrals
      </Link>

      <div className="mb-6">
        <Pill tone={statusTone(data.status)}>{statusLabel(data.status)}</Pill>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <div className="flex flex-col gap-5">
          <Card title="Referral details">
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <DetailRow
                label="Referred contact"
                value={data.contactName || "—"}
              />
              <DetailRow label="Program" value={data.programLabel} />
              <DetailRow label="Product" value={data.product || "—"} />
              <DetailRow label="Source" value={data.sourceLabel} />
              <DetailRow label="Referral date" value={data.referralDateLabel} />
              <DetailRow
                label="Attribution window"
                value={data.attributionWindowLabel}
              />
              <DetailRow
                label="Conversion date"
                value={data.conversionDateLabel || "—"}
              />
            </div>
          </Card>

          <Card title="Timeline">
            <ul className="m-0 list-none space-y-4 p-0">
              {data.timeline.map((item) => (
                <li key={item.id} className="flex gap-5">
                  <div
                    className="w-[110px] shrink-0 text-[13px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {item.dateLabel}
                  </div>
                  <div className="text-[13.5px] leading-[1.45]" style={{ color: "var(--ink)" }}>
                    {item.parts.map((part, index) =>
                      part.bold ? (
                        <strong key={index} className="font-semibold">
                          {part.text}
                        </strong>
                      ) : (
                        <span key={index}>{part.text}</span>
                      ),
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {!data.hasAttributionEvents ? (
              <p
                className="m-0 mt-4 border-t pt-4 text-[13.5px] leading-[1.5]"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                Activity will show here when this person enrolls or
                subscribes.
              </p>
            ) : null}
          </Card>
        </div>

        <div>
          {data.earning ? (
            <Card title="Earning">
              <div className="space-y-3.5">
                <DetailRow label="Rate" value={data.earning.rateLabel} />
                <DetailRow label="Basis" value={data.earning.basisLabel} />
                <div>
                  <div
                    className="mb-0.5 text-[12.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Amount
                  </div>
                  <div
                    className="text-[20px] font-bold tabular-nums"
                    style={{ color: "var(--ink)" }}
                  >
                    {formatMoney(data.earning.amount)}
                  </div>
                </div>
                <div>
                  <Pill tone={earningStatusTone(data.earning.status)}>
                    {data.earning.statusLabel}
                  </Pill>
                </div>
                {data.earning.status === "pending" &&
                data.earning.paymentTerms ? (
                  <p
                    className="m-0 border-t pt-3 text-[12.5px] leading-[1.45]"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    Payment terms: {data.earning.paymentTerms}.
                  </p>
                ) : null}
              </div>
            </Card>
          ) : (
            <Card title="Earning">
              <p
                className="m-0 text-[13.5px] leading-[1.5]"
                style={{ color: "var(--text-secondary)" }}
              >
                No earning yet for this referral.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
