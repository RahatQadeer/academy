import { Pill } from "@/base/components/Pill";
import { PORTAL_AREAS } from "@/client-portal/lib/access";
import type { PortalContext } from "@/client-portal/lib/portal-context";
import { AreaGrid } from "./AreaGrid";

/**
 * What the signed-in person can reach — one line, with the nine areas behind it.
 *
 * WHY IT IS A LINE NOW
 *
 * The portal acts on this everywhere — the nav is drawn from it and every
 * screen and write is gated on it — so somewhere it has to be written down. A
 * client who cannot find Billing is otherwise left deciding between "I am not
 * allowed" and "this is broken", and only one of those is worth telling their
 * team about. That is the case for saying it; it is not a case for saying it at
 * the top of the screen in a card of nine rows every time.
 *
 * And for the person who most often opens this screen it was nine rows with a
 * tick against every one: the primary member holds the account, so the grid
 * could only ever say yes nine times. The answer is one line — "Primary member
 * · every area" — and the grid is behind it for the reader who wants the
 * wording of each.
 *
 * Open by default for anybody else, because for them the grid is the answer
 * rather than the footnote: their access was decided by somebody else and the
 * gaps in it are the half worth reading.
 */
export function YourAccess({ context }: { context: PortalContext }) {
  const granted = PORTAL_AREAS.filter((area) => context.areas[area.key]).length;
  const everything = granted === PORTAL_AREAS.length;

  // The primary member's own summary is a fact about the account rather than a
  // count: they hold it, so the number could never be anything else.
  const summary =
    context.role === "primary_member" || context.areasInherited
      ? "Every area"
      : `${granted} of ${PORTAL_AREAS.length} areas`;

  return (
    <details
      className="cp-band mb-5 overflow-hidden rounded-card-cp border border-line bg-surface"
      open={!everything}
    >
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
        <span className="cp-band-caret shrink-0" aria-hidden>
          ›
        </span>
        <span className="text-[13.5px] font-semibold">Your access</span>
        <Pill tone="accent">{context.roleLabel}</Pill>
        {context.viewOnly ? <Pill tone="neutral">View only</Pill> : null}
        <span className="ml-auto text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {summary}
        </span>
      </summary>

      <div className="border-t border-line px-4 py-4">
        <p
          className="mb-3.5 max-w-2xl text-[13px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {context.role === "primary_member"
            ? "You hold this account, so every area is yours. Anyone else you ask to have added is granted areas one at a time."
            : context.areasInherited
              ? "Your team has not set per-area limits on your access, so every area of this portal is open to you."
              : "Your team decides which areas of this account you can reach. Ask them if you need one that is not here."}
        </p>

        <AreaGrid areas={context.areas} viewOnly={context.viewOnly} />
      </div>
    </details>
  );
}
