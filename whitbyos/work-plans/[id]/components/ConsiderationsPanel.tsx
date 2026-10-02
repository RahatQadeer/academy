import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { NoticedRow, ShowRest, SHOWN } from "@/whitbyos/work-plans/[id]/components/NoticedSection";

/** What each kind of Consideration is, in the words the screen should use. */
const KIND: Record<string, { label: string; tone: "danger" | "warning" | "neutral" }> = {
  missing_info: { label: "Not confirmed", tone: "warning" },
  dependency_conflict: { label: "Timing conflict", tone: "danger" },
  stale_info: { label: "May be out of date", tone: "warning" },
  risk_backup_gap: { label: "No fallback", tone: "danger" },
  calendar_conflict: { label: "Calendar clash", tone: "danger" },
  requirement_prompt: { label: "Usually required", tone: "neutral" },
  next_action: { label: "Do first", tone: "neutral" },
};

/** Most pressing first, so the order on the screen is the order to act in. */
const ORDER = [
  "dependency_conflict",
  "calendar_conflict",
  "risk_backup_gap",
  "missing_info",
  "stale_info",
  "requirement_prompt",
  "next_action",
];

export type ConsiderationItem = {
  id: string;
  summary: string;
  scope: string | null;
  kind?: string | null;
  /** Where to go to act on it, where there is such a place. */
  action?: { href: string; label: string } | null;
};

/**
 * What Whitby noticed about this plan that the plan does not resolve.
 *
 * These lived in the rail, in a 280px box, in the same grey as Key Dates and
 * Linked — a timing conflict between two Work Streams shown at the size of a
 * "Last updated" line, three panels below the Risks it belongs beside. A
 * Consideration and a Risk are the same act of reading: here is what is not
 * settled. They sit together now, under the work they are about, in the same
 * shape, with the pressing ones first.
 */
export function ConsiderationsPanel({
  items,
  basePath,
  all,
}: {
  items: ConsiderationItem[];
  basePath: string;
  all: boolean;
}) {
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => rank(a.kind) - rank(b.kind));
  const shown = all ? sorted : sorted.slice(0, SHOWN);

  return (
    <>
      {shown.map((item) => {
        const kind = KIND[item.kind ?? ""] ?? null;

        return (
          <NoticedRow key={item.id}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
              {/* Where it applies, then what kind of thing it is. A reader
                  scanning for their own Work Stream looks for the name. */}
              <Pill tone={kind?.tone ?? "neutral"}>{item.scope ?? "Plan-wide"}</Pill>
              {kind ? (
                <span
                  className="text-[10.5px] font-semibold uppercase tracking-[.05em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {kind.label}
                </span>
              ) : null}
            </div>

            <p
              className="text-[13px] leading-[1.55]"
              style={{ margin: "6px 0 0", color: "var(--ink)" }}
            >
              {item.summary}
            </p>

            {/* Some of these have an obvious answer, and telling somebody to go
                and find the screen that holds it is most of the work. */}
            {item.action ? (
              <Link
                href={item.action.href}
                className="mt-2 inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-[12.5px] font-medium no-underline"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
              >
                {item.action.label}
                <span aria-hidden>→</span>
              </Link>
            ) : null}
          </NoticedRow>
        );
      })}

      <ShowRest
        hidden={all ? 0 : sorted.length - shown.length}
        href={`${basePath}?noticed=considerations&all=1`}
        noun="consideration"
      />
    </>
  );
}

function rank(kind: string | null | undefined): number {
  const at = ORDER.indexOf(kind ?? "");
  return at === -1 ? ORDER.length : at;
}
