import type { AcademyAuditLogItem } from "../types";
import { AuditLogRow } from "./AuditLogRow";

export function AuditLogList({
  items,
  truncated,
}: {
  items: AcademyAuditLogItem[];
  truncated: boolean;
}) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-[14px] bg-white px-6 py-14 text-center"
        style={{ border: "1px solid var(--border)" }}
      >
        <p className="text-[16px] font-medium tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
          No activity yet
        </p>
        <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
          Account changes and settings updates will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul
        className="m-0 overflow-hidden rounded-[14px] bg-white p-0 shadow-[0_1px_2px_rgba(55,53,47,0.04)]"
        style={{ border: "1px solid var(--border)", listStyle: "none" }}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            style={{
              borderTop: index > 0 ? "1px solid var(--border)" : undefined,
            }}
          >
            <AuditLogRow item={item} />
          </li>
        ))}
      </ul>
      {truncated ? (
        <p className="px-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Showing the most recent events.
        </p>
      ) : null}
    </div>
  );
}
