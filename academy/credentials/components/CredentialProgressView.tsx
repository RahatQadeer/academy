import Link from "next/link";
import { AdminCredentialNote } from "./AdminCredentialNote";
import { CredentialIdentityCard } from "./CredentialIdentityCard";
import { CredentialProgressSteps } from "./CredentialProgressSteps";
import { CertificateEligibilityCard } from "./CertificateEligibilityCard";
import type { CredentialDetailData } from "../types/detail";

export function CredentialProgressView({ data }: { data: CredentialDetailData }) {
  return (
    <div>
      <Link
        href="/academy/credentials"
        className="text-[13.5px] no-underline hover:text-accent-hover"
        style={{ color: "var(--accent)" }}
      >
        ← Certificates & Credentials
      </Link>

      <h1 className="mt-4 text-[24px] font-medium leading-tight text-pretty">{data.programName}</h1>

      {data.reviewerNote?.trim() ? (
        <div className="mt-5">
          <AdminCredentialNote title="Note from Academy Admin" tone="warning">
            {data.reviewerNote}
          </AdminCredentialNote>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
        <CredentialProgressSteps steps={data.steps} />
        <div className="space-y-6">
          <CertificateEligibilityCard data={data} />
          {data.showIdentityCard ? (
            <CredentialIdentityCard title={data.identityCardTitle} body={data.identityCardBody} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
