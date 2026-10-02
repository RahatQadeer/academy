import { CircleDollarSign } from "lucide-react";

export function EarningsEmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="max-w-[420px] text-center">
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[10px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          aria-hidden
        >
          <CircleDollarSign size={22} strokeWidth={2.25} />
        </div>
        <h2
          className="m-0 mb-2 text-[18px] font-semibold tracking-[-0.2px]"
          style={{ color: "var(--ink)" }}
        >
          No earnings yet
        </h2>
        <p
          className="m-0 text-[14px] leading-[1.55]"
          style={{ color: "var(--text-secondary)" }}
        >
          Commission from converted referrals and opportunities will show here
          when payments are collected.
        </p>
      </div>
    </div>
  );
}
