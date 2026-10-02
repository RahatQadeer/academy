import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The three readings under a plan, in one place, one at a time.
 *
 * Dependencies, Considerations and Risks answer one question between them —
 * what about this plan is not settled — and stacking all three full-length put
 * the last of them a long way down a page somebody had already scrolled to
 * reach. They are tabs now: the counts are all visible at once, and only the
 * one being read takes up room.
 *
 * Long lists cut at four with a link to the rest, for the same reason. Nobody
 * scrolls past the fourth risk looking for the first.
 */
const SHOWN = 4;

export function NoticedTabs({
  basePath,
  active,
  tabs,
}: {
  basePath: string;
  /** The `noticed` search param, or the first tab that has anything in it. */
  active: string;
  tabs: {
    key: string;
    label: string;
    count: number;
    body: ReactNode;
    /** Risks read in the danger colour, chosen or not. A risk is the one
        of these three that is about something going wrong. */
    tone?: "danger";
  }[];
}) {
  const live = tabs.filter((tab) => tab.count > 0);
  if (live.length === 0) return null;

  const current = live.find((tab) => tab.key === active) ?? live[0]!;

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center gap-1">
        {live.map((tab) => {
          const on = tab.key === current.key;
          return (
            <Link
              key={tab.key}
              href={`${basePath}?noticed=${tab.key}`}
              scroll={false}
              className="flex items-center gap-1.5 rounded-control px-3 py-1.5 text-[13px] no-underline"
              style={
                on
                  ? {
                      background:
                        tab.tone === "danger"
                          ? "var(--danger-action-bg)"
                          : "var(--surface-active)",
                      color: tab.tone === "danger" ? "var(--danger-action-fg)" : "var(--ink)",
                      fontWeight: 600,
                    }
                  : {
                      color:
                        tab.tone === "danger"
                          ? "var(--danger-action-fg)"
                          : "var(--text-secondary)",
                      fontWeight: 500,
                    }
              }
            >
              {tab.label}
              <span
                className="rounded-[9px] px-[6px] py-px text-[10.5px] font-semibold"
                style={
                  on
                    ? {
                        background:
                          tab.tone === "danger" ? "var(--danger-action-fg)" : "var(--ink)",
                        color: "#fff",
                      }
                    : {
                        background:
                          tab.tone === "danger"
                            ? "var(--danger-action-bg)"
                            : "var(--surface-active)",
                        color:
                          tab.tone === "danger"
                            ? "var(--danger-action-fg)"
                            : "var(--text-tertiary)",
                      }
                }
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div
        className="overflow-hidden rounded-[10px] border border-line bg-surface"
        style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
      >
        {current.body}
      </div>
    </section>
  );
}

/** One entry inside a Noticed card. */
export function NoticedRow({ children }: { children: ReactNode }) {
  return <div className="border-b border-line px-4 py-3.5 last:border-b-0">{children}</div>;
}

/**
 * The last row of a cut list: how many are not shown, and the way to see them.
 *
 * A link rather than a details/summary, because the state belongs in the URL —
 * somebody who opened the rest and then ticked a task off should still be
 * looking at the rest.
 */
export function ShowRest({
  hidden,
  href,
  noun,
}: {
  hidden: number;
  href: string;
  noun: string;
}) {
  if (hidden <= 0) return null;

  return (
    <Link
      href={href}
      scroll={false}
      className="flex items-center justify-center gap-1.5 border-t border-line px-4 py-2.5 text-[12.5px] font-medium no-underline"
      style={{ background: "var(--surface-soft)", color: "var(--accent)" }}
    >
      Show {hidden} more {noun}
      {hidden === 1 ? "" : "s"}
    </Link>
  );
}

/** How many of a list to draw before offering the rest. */
export { SHOWN };
