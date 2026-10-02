import { PORTAL_AREAS } from "@/client-portal/lib/access";
import type { AreaAccess } from "@/client-portal/types";

/**
 * The nine areas, and whether this person holds each one.
 *
 * Drawn in full rather than as a list of the granted ones: the question a
 * client opens this screen with is "what can they see?", and only showing what
 * is on leaves them counting absences to work out what is off.
 */
export function AreaGrid({
  areas,
  viewOnly = false,
}: {
  areas: AreaAccess;
  /** Adds the qualifier that reading is all any of these grants. */
  viewOnly?: boolean;
}) {
  return (
    <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {PORTAL_AREAS.map((area) => {
        const on = areas[area.key];
        return (
          <li key={area.key} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-[3px] text-[13px] leading-none"
              style={{ color: on ? "var(--success-fg)" : "var(--text-tertiary)" }}
            >
              {on ? "✓" : "○"}
            </span>
            <span className="min-w-0">
              <span
                className="block text-[13.5px] font-medium"
                style={{ color: on ? "var(--ink)" : "var(--text-tertiary)" }}
              >
                {area.label}
                <span className="sr-only">
                  {on ? ", granted" : ", not granted"}
                </span>
              </span>
              <span
                className="block text-[12.5px] leading-snug"
                style={{ color: "var(--text-tertiary)" }}
              >
                {on && viewOnly ? `${area.what} View only.` : area.what}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
