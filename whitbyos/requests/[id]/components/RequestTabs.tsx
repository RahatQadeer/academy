import Link from "next/link";
import { REQUEST_TABS, type RequestTab } from "@/whitbyos/lib/request-detail";

/** Screens 3.3o–3.3w's tab strip, blue-underlined on the one you are on. */
export function RequestTabs({
  requestId,
  active,
}: {
  requestId: string;
  active: RequestTab;
}) {
  return (
    <div className="mb-6 flex gap-[22px] border-b border-line">
      {REQUEST_TABS.map((tab) => {
        const on = tab.slug === active;
        const href = tab.slug
          ? `/whitbyos/requests/${requestId}/${tab.slug}`
          : `/whitbyos/requests/${requestId}`;

        return (
          <Link
            key={tab.label}
            href={href}
            className="pb-2.5 text-[13.5px] no-underline"
            style={{
              color: on ? "var(--ink)" : "var(--text-tertiary)",
              fontWeight: on ? 600 : 400,
              borderBottom: on ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
