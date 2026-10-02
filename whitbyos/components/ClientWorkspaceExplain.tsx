import { CLIENT_WORKSPACE_EXPLAIN } from "@/whitbyos/lib/client-workspace-copy";

export function ClientWorkspaceExplain({
  compact = false,
}: {
  compact?: boolean;
}) {
  const items = [
    CLIENT_WORKSPACE_EXPLAIN.what,
    CLIENT_WORKSPACE_EXPLAIN.when,
    CLIENT_WORKSPACE_EXPLAIN.none,
  ];

  return (
    <div
      className={`rounded-[10px] border border-line ${compact ? "px-4 py-3.5" : "px-4 py-4"}`}
      style={{ background: "var(--surface-soft)" }}
    >
      <div className={compact ? "flex flex-col gap-3" : "flex flex-col gap-3.5"}>
        {items.map((item) => (
          <div key={item.title}>
            <div className="text-[13px] font-semibold">{item.title}</div>
            <p
              className="mt-0.5 text-[12.5px] leading-[1.55]"
              style={{ color: "var(--text-secondary)" }}
            >
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
