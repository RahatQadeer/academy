import { PORTAL_AREAS } from "@/client-portal/lib/access";
import type { AreaAccess } from "@/client-portal/types";

/**
 * "Can access: Requests · Messages · Documents" as a row of chips.
 *
 * The compact form of `AreaGrid`, for a person row that has to stay one or two
 * lines tall. Every area is drawn, granted or not — the same reasoning
 * `AreaGrid` gives: on a screen about permissions, what somebody has *not* got
 * is half the answer, and listing only the granted ones leaves a reader
 * counting absences.
 *
 * An area that is off keeps its label and loses its emphasis rather than being
 * struck through. A strike reads as "was revoked"; this is simply not granted,
 * and in most cases never was.
 */
export function AreaChips({
  areas,
  viewOnly = false,
}: {
  areas: AreaAccess;
  viewOnly?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="mr-0.5 text-[12.5px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Can access:
      </span>
      {PORTAL_AREAS.map((area) => {
        const on = areas[area.key];
        return (
          <span
            key={area.key}
            title={on ? area.what : `Not granted — ${area.what}`}
            className="rounded-full border px-2 py-[3px] text-[12px] leading-none"
            style={
              on
                ? {
                    borderColor: "var(--accent)",
                    background: "var(--accent-tint-mid)",
                    color: "var(--accent-hover)",
                  }
                : {
                    borderColor: "var(--line)",
                    color: "var(--text-tertiary)",
                  }
            }
          >
            {area.label}
            <span className="sr-only">{on ? ", granted" : ", not granted"}</span>
          </span>
        );
      })}
      {viewOnly ? (
        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          · view only
        </span>
      ) : null}
    </div>
  );
}
