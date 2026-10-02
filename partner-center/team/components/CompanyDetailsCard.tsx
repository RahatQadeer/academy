"use client";

import { useState } from "react";
import { EditCompanyModal } from "@/partner-center/team/components/EditCompanyModal";
import type { TeamPageData } from "@/partner-center/team/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-[12.5px] font-medium uppercase tracking-[0.04em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>
      <div className="mt-1 text-[14px] leading-snug" style={{ color: "var(--ink)" }}>
        {children}
      </div>
    </div>
  );
}

function formatPartnerSince(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function websiteHref(website: string | null) {
  if (!website?.trim()) return null;
  const trimmed = website.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function CompanyDetailsCard({ data }: { data: TeamPageData }) {
  const [editing, setEditing] = useState(false);
  const href = websiteHref(data.website);

  return (
    <>
      <section>
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="m-0 text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
            {data.isIndividual ? "Partner details" : "Company details"}
          </h2>
          {data.canManage ? (
            <button
              type="button"
              className="border-0 bg-transparent p-0 text-[13.5px] font-medium"
              style={{ color: "var(--accent)", cursor: "pointer" }}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          ) : null}
        </div>
        <div className="pa-partner-card p-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label={data.isIndividual ? "Name" : "Legal name"}>
              {data.companyName || "—"}
            </Field>
            <Field label="Website">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  {data.website}
                </a>
              ) : (
                "—"
              )}
            </Field>
            {data.isIndividual && data.primaryContact ? (
              <>
                <Field label="Email">{data.primaryContact.email}</Field>
                <Field label="Phone">{data.primaryContact.phone || "—"}</Field>
              </>
            ) : null}
            <Field label="Business type">{data.businessType || "—"}</Field>
            <Field label="Markets served">{data.marketsLabel}</Field>
            <Field label="Audience served">{data.audienceServed || "—"}</Field>
            <Field label="Partner since">{formatPartnerSince(data.partnerSince)}</Field>
          </div>
        </div>
      </section>
      {editing ? (
        <EditCompanyModal
          companyName={data.companyName}
          legalName={data.companyName}
          website={data.website ?? ""}
          businessType={data.businessType ?? ""}
          markets={data.marketsRaw}
          audienceServed={data.audienceServed ?? ""}
          individual={data.isIndividual}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}
