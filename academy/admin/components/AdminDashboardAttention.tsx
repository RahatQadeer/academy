import Link from "next/link";
import { Surface } from "@/academy/components/ui";

type AttentionItem = {
  key: string;
  count: number;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
};

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.5L6.5 11.5L12.5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2.4a3.6 3.6 0 0 1 3.6 3.6v2.1l.9 1.7H3.5l.9-1.7V6A3.6 3.6 0 0 1 8 2.4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.4 13.2a1.7 1.7 0 0 0 3.2 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="mt-[1px] inline-flex h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-[8px] px-1.5 text-[12.5px] font-semibold tabular-nums"
          style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
        >
          {item.count.toLocaleString()}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-medium leading-snug text-pretty">{item.title}</p>
          <p
            className="mt-0.5 text-[13px] leading-relaxed text-pretty"
            style={{ color: "var(--text-secondary)" }}
          >
            {item.detail}
          </p>
        </div>
      </div>
      <Link
        href={item.href}
        className="shrink-0 self-start text-[13.5px] font-medium text-accent no-underline transition-colors hover:text-accent-hover sm:self-center"
      >
        {item.actionLabel} →
      </Link>
    </div>
  );
}

export function AdminDashboardAttention({
  pendingCount,
  credentialReviewCount,
}: {
  pendingCount: number;
  credentialReviewCount: number;
}) {
  const items: AttentionItem[] = [];

  if (pendingCount > 0) {
    items.push({
      key: "publish",
      count: pendingCount,
      title:
        pendingCount === 1
          ? "Publish request awaiting review"
          : "Publish requests awaiting review",
      detail:
        "Instructors cannot set content live. Nothing publishes until you approve it here.",
      href: "/academy/admin/approvals",
      actionLabel: "Review queue",
    });
  }

  if (credentialReviewCount > 0) {
    items.push({
      key: "credentials",
      count: credentialReviewCount,
      title:
        credentialReviewCount === 1
          ? "Credential awaiting final review"
          : "Credentials awaiting final review",
      detail: "Learners have finished their requirements and are waiting to be awarded.",
      href: "/academy/admin/credentials",
      actionLabel: "Review credentials",
    });
  }

  return (
    <section aria-labelledby="admin-attention-heading">
      <Surface elevated>
        <div
          className="flex items-center gap-2.5 border-b px-5 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-[9px]"
            style={{
              background: items.length > 0 ? "var(--warning-bg)" : "var(--success-bg)",
              color: items.length > 0 ? "var(--warning-fg)" : "var(--success-fg)",
            }}
            aria-hidden
          >
            {items.length > 0 ? <BellIcon /> : <CheckIcon />}
          </span>
          <div>
            <h2
              id="admin-attention-heading"
              className="text-[15px] font-semibold tracking-[-0.2px]"
            >
              Needs attention
            </h2>
            <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {items.length > 0
                ? "Open items waiting on an Academy Admin."
                : "Nothing is waiting on you right now."}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex items-center gap-2.5 px-5 py-4">
            <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              No publish requests or credential reviews are open.
            </p>
          </div>
        ) : (
          <div>
            {items.map((item, index) => (
              <div
                key={item.key}
                style={index > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
              >
                <AttentionRow item={item} />
              </div>
            ))}
          </div>
        )}
      </Surface>
    </section>
  );
}
