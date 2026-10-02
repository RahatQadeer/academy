import type { ActivityItem } from "@/partner-center/home/types";

export function RecentActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div
        className="pa-partner-card px-6 py-10 text-center text-[14px]"
        style={{ color: "var(--text-secondary)" }}
      >
        No recent activity yet. Referrals, opportunities, and earnings will
        show up here.
      </div>
    );
  }

  return (
    <div>
      {items.map((item, index) => (
        <div
          key={item.id}
          className="flex gap-4 py-3.5"
          style={{
            borderBottom:
              index < items.length - 1 ? "1px solid var(--border)" : undefined,
          }}
        >
          <span
            className="w-[90px] shrink-0 text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {item.label}
          </span>
          <span className="text-[13.5px]" style={{ color: "var(--ink)" }}>
            {item.parts.map((part, partIndex) =>
              part.bold ? (
                <strong key={partIndex} className="font-semibold">
                  {part.text}
                </strong>
              ) : (
                <span key={partIndex}>{part.text}</span>
              ),
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
