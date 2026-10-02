import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import type { ActionNeededItem } from "@/partner-center/home/types";

const CATEGORY_TONE: Record<
  ActionNeededItem["category"],
  "warning" | "info" | "neutral"
> = {
  payout: "warning",
  document: "neutral",
  setup: "info",
  message: "info",
};

const CATEGORY_LABEL: Record<ActionNeededItem["category"], string> = {
  payout: "Payout",
  document: "Document",
  setup: "Setup",
  message: "Message",
};

export function ActionNeededList({ items }: { items: ActionNeededItem[] }) {
  if (items.length === 0) {
    return (
      <div
        className="pa-partner-card px-6 py-10 text-center text-[14px]"
        style={{ color: "var(--text-secondary)" }}
      >
        You&apos;re all caught up — nothing needs your attention right now.
      </div>
    );
  }

  return (
    <div className="pa-partner-card overflow-hidden">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="flex items-center gap-4 px-6 py-[18px]"
          style={{
            borderBottom:
              index < items.length - 1 ? "1px solid var(--border)" : undefined,
          }}
        >
          <Pill tone={CATEGORY_TONE[item.category]}>
            {CATEGORY_LABEL[item.category]}
          </Pill>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
              {item.title}
            </div>
            {item.detail ? (
              <div
                className="mt-0.5 text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {item.detail}
              </div>
            ) : null}
          </div>
          <Link
            href={item.href}
            className="shrink-0 text-[13px] font-semibold no-underline"
            style={{ color: "var(--accent)" }}
          >
            {item.cta} →
          </Link>
        </div>
      ))}
    </div>
  );
}
