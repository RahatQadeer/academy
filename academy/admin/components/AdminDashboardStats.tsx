import { StatCard, StatGrid } from "@/academy/components/ui";
import type { AdminDashboardData } from "../types";

function WaitingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5v3.2L10.2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function EnrollmentIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6" cy="5.2" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.5 13c.35-2.2 1.8-3.4 3.5-3.4s3.15 1.2 3.5 3.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="11.2" cy="6" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.4 13c.2-1.3.85-2.15 1.7-2.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CompletionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.4 8.2l1.7 1.7 3.5-3.6"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CatalogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function AdminDashboardStats({ data }: { data: AdminDashboardData }) {
  const waitingOnYou = data.pendingCount + data.credentialReviewCount;
  const completionRate =
    data.enrollmentCount > 0
      ? Math.round((data.enrollmentCompletedCount / data.enrollmentCount) * 100)
      : 0;

  const waitingHref =
    data.pendingCount > 0
      ? "/academy/admin/approvals"
      : data.credentialReviewCount > 0
        ? "/academy/admin/credentials"
        : "/academy/admin/approvals";

  const waitingDetail =
    waitingOnYou === 0
      ? "Nothing is waiting on you"
      : [
          data.pendingCount > 0
            ? `${data.pendingCount.toLocaleString()} publish ${data.pendingCount === 1 ? "request" : "requests"}`
            : null,
          data.credentialReviewCount > 0
            ? `${data.credentialReviewCount.toLocaleString()} credential ${data.credentialReviewCount === 1 ? "review" : "reviews"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <section aria-label="Academy operations">
      <StatGrid>
        <StatCard
          value={waitingOnYou}
          label="Waiting on you"
          detail={waitingDetail}
          icon={<WaitingIcon />}
          tone="warning"
          href={waitingHref}
        />
        <StatCard
          value={data.enrollmentActiveCount}
          label="Active enrollments"
          detail={
            data.enrollmentCount > 0
              ? `${data.enrollmentCount.toLocaleString()} total · ${data.learnerCount.toLocaleString()} learners`
              : "No enrollments yet"
          }
          icon={<EnrollmentIcon />}
          tone="info"
          href="/academy/admin/enrollments"
        />
        <StatCard
          value={data.enrollmentCount === 0 ? "—" : `${completionRate}%`}
          label="Completion rate"
          detail={
            data.enrollmentCount > 0
              ? `${data.enrollmentCompletedCount.toLocaleString()} of ${data.enrollmentCount.toLocaleString()} enrollments finished`
              : "No enrollments yet"
          }
          icon={<CompletionIcon />}
          tone="success"
          progress={data.enrollmentCount > 0 ? completionRate : undefined}
          href="/academy/admin/enrollments"
        />
        <StatCard
          value={data.programPublished}
          label="Published programs"
          detail={`${data.programTotal.toLocaleString()} in catalog${
            data.programDraft > 0 ? ` · ${data.programDraft.toLocaleString()} draft` : ""
          }`}
          icon={<CatalogIcon />}
          tone="accent"
          href="/academy/admin/programs"
        />
      </StatGrid>
    </section>
  );
}
