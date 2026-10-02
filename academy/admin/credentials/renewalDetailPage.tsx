import { Suspense } from "react";
import { Callout } from "@/base/components/Callout";
import { AdminRenewalDetailView } from "./components/AdminRenewalDecisionPanel";
import { loadAdminRenewalDetail } from "./services/loadAdminRenewals";

async function DetailBody({ renewalRequestId }: { renewalRequestId: string }) {
  const result = await loadAdminRenewalDetail(renewalRequestId);
  if (!result.ok) {
    return (
      <div className="px-5 py-8 sm:px-7">
        <Callout tone="warning" title={result.reason === "unauthorized" ? "Admin access required" : "Not found"}>
          This renewal request could not be opened.
        </Callout>
      </div>
    );
  }
  return <AdminRenewalDetailView detail={result.data} />;
}

export function AdminRenewalDetailPage({ renewalRequestId }: { renewalRequestId: string }) {
  return (
    <Suspense
      fallback={
        <div className="px-5 py-8 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Loading renewal…
        </div>
      }
    >
      <DetailBody renewalRequestId={renewalRequestId} />
    </Suspense>
  );
}
