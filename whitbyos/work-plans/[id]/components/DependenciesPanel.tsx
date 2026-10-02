import Link from "next/link";
import type { PlanDependency } from "@/whitbyos/lib/work-plans";
import { NoticedRow, ShowRest, SHOWN } from "@/whitbyos/work-plans/[id]/components/NoticedSection";

/**
 * What in this plan is waiting, gathered under what it is waiting for.
 *
 * It was one row per dependency: seven rows, each reading "cannot start until
 * X is done", with the same X on four of them. The repetition was the finding
 * — one task holds up four others — and printing it four times was the one
 * way to say that without anybody noticing.
 *
 * So it reads the other way round now: the thing everything is waiting for
 * first, with what it holds up under it. Whatever blocks the most comes first,
 * because that is the one worth unblocking.
 */
export function DependenciesPanel({
  items,
  basePath,
  all,
}: {
  items: PlanDependency[];
  basePath: string;
  /** Whether the reader asked for the whole list. */
  all: boolean;
}) {
  if (items.length === 0) return null;

  const groups = new Map<
    string,
    { on: string; onId: string | null; scale: PlanDependency["scale"]; waiting: PlanDependency[] }
  >();

  for (const row of items) {
    const key = `${row.scale}:${row.on}`;
    const found = groups.get(key);
    if (found) {
      found.waiting.push(row);
      continue;
    }
    groups.set(key, { on: row.on, onId: row.onId, scale: row.scale, waiting: [row] });
  }

  const ordered = [...groups.values()].sort((a, b) => b.waiting.length - a.waiting.length);
  const shown = all ? ordered : ordered.slice(0, SHOWN);

  return (
    <>
      {shown.map((group) => (
        <NoticedRow key={`${group.scale}:${group.on}`}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              className="text-[10.5px] font-semibold uppercase tracking-[.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {group.scale === "stream" ? "Work Stream" : "Task"}
            </span>

            {group.onId && group.scale === "task" ? (
              <Link
                href={`${basePath}/tasks/${group.onId}`}
                className="text-[13.5px] font-medium no-underline"
                style={{ color: "var(--ink)" }}
              >
                {group.on}
              </Link>
            ) : (
              <span className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                {group.on}
              </span>
            )}

            {/* The count is the point: one task holding up four is a
                bottleneck, one holding up one is just an order of work. */}
            <span
              className="rounded-[9px] px-[7px] py-px text-[10.5px] font-semibold"
              style={
                group.waiting.length > 1
                  ? { background: "var(--warning-bg)", color: "var(--warning-fg)" }
                  : { background: "var(--surface-active)", color: "var(--text-tertiary)" }
              }
            >
              holds up {group.waiting.length}
            </span>
          </div>

          <div className="mt-2 flex flex-col gap-1">
            {group.waiting.map((row, index) => (
              <div key={index} className="flex items-baseline gap-2 text-[12.5px]">
                <span style={{ color: "var(--warning-fg)" }} aria-hidden>
                  ↳
                </span>
                {row.blockedId && row.scale === "task" ? (
                  <Link
                    href={`${basePath}/tasks/${row.blockedId}`}
                    className="no-underline"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {row.blocked}
                  </Link>
                ) : (
                  <span style={{ color: "var(--text-secondary)" }}>{row.blocked}</span>
                )}
              </div>
            ))}
          </div>
        </NoticedRow>
      ))}

      <ShowRest
        hidden={all ? 0 : ordered.length - shown.length}
        href={`${basePath}?noticed=waiting&all=1`}
        // Groups, not rows: the cut is by what does the blocking.
        noun="blocker"
      />
    </>
  );
}
