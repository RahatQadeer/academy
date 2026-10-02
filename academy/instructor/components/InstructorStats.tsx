import { StatCard, StatGrid } from "@/academy/components/ui";
import type { InstructorDashboardStats } from "../types";

function AssignedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10.4 3.1l2.5 2.5M4 12.4l-.6 2.1 2.1-.6 6.4-6.4-1.5-1.5L4 12.4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5.2v3.1l2 1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PublishedIcon() {
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

export function InstructorStats({ stats }: { stats: InstructorDashboardStats }) {
  return (
    <section aria-label="Assigned catalog totals">
      <StatGrid>
        <StatCard
          value={stats.assigned}
          label="Assigned"
          detail="Programs you can edit"
          href="/academy/instructor/programs"
          icon={<AssignedIcon />}
          tone="accent"
        />
        <StatCard
          value={stats.pendingReviews}
          label="To review"
          detail="Assignment submissions waiting"
          href="/academy/instructor/reviews"
          icon={<PendingIcon />}
          tone="warning"
        />
        <StatCard
          value={stats.pendingApproval}
          label="Pending approval"
          detail="Waiting on an Academy Admin"
          icon={<DraftIcon />}
          tone="info"
        />
        <StatCard
          value={stats.published}
          label="Published"
          detail="Live in the catalog"
          icon={<PublishedIcon />}
          tone="success"
        />
      </StatGrid>
    </section>
  );
}
