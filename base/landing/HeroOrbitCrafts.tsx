import type { ReactNode } from "react";

/** Plane & yacht marks that travel along hero route arcs (not circular rings). */

export const TRIP_ROUTE_PLANE =
  "M160 400 C 300 140, 700 140, 840 380";
export const TRIP_ROUTE_BOAT =
  "M120 640 C 340 520, 460 700, 540 580 S 760 480, 880 620";

type CraftProps = {
  className?: string;
};

function CraftBadge({ children, className }: CraftProps & { children: ReactNode }) {
  return (
    <g className={className}>
      <circle r="19" className="trip-orbit-craft-bg" />
      {children}
    </g>
  );
}

/** Nose points +X (east); parent group rotates around the ring. */
export function OrbitPlaneMark({ className }: CraftProps) {
  return (
    <CraftBadge className={className}>
      <g transform="translate(-11 -11)">
        <path
          className="trip-orbit-craft-fill trip-orbit-craft-fill--plane"
          d="M2 11h5.2l1.6-4.2 1.8 4.2H16l-3.2 1.6.8 3.6-3.6-1.8-3.6 1.8.8-3.6L2 11z"
        />
      </g>
    </CraftBadge>
  );
}

export function OrbitBoatMark({ className }: CraftProps) {
  return (
    <CraftBadge className={className}>
      <g transform="translate(-11 -11)">
        <path
          className="trip-orbit-craft-fill trip-orbit-craft-fill--boat"
          d="M3 13.5h16l-1.8-3.2H4.8L3 13.5zm6.2-8.2v4.2M9.2 5.3l2.2 2.2M9.2 9.5H6.8M9.2 9.5h2.4"
          fill="none"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="trip-orbit-craft-fill trip-orbit-craft-fill--boat"
          d="M3 13.5h16l-1.4-2.5H4.4L3 13.5z"
        />
      </g>
    </CraftBadge>
  );
}
