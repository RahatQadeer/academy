import type { AcademyRole } from "@/academy/lib/types";

type IconProps = { size?: number };

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.45,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function AcademyRoleIcon({ role, size = 14 }: IconProps & { role: AcademyRole }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      {role === "super_admin" ? (
        <>
          <path d="M8 2.5l5 1.6v4.4c0 2.8-1.9 4.8-5 5.5-3.1-.7-5-2.7-5-5.5V4.1L8 2.5z" {...stroke} />
          <path d="M8 6.2v2.2M8 10.2h.01" {...stroke} />
        </>
      ) : role === "admin" ? (
        <path d="M8 2.5l5 1.6v4.4c0 2.8-1.9 4.8-5 5.5-3.1-.7-5-2.7-5-5.5V4.1L8 2.5z" {...stroke} />
      ) : role === "instructor" ? (
        <>
          <circle cx="8" cy="5.2" r="2" {...stroke} />
          <path d="M3.4 13c.4-2.5 2-3.8 4.6-3.8s4.2 1.3 4.6 3.8" {...stroke} />
        </>
      ) : (
        <>
          <path d="M2.5 7.2L8 2.5l5.5 4.7V13a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V7.2z" {...stroke} />
          <path d="M6 14V9h4v5" {...stroke} />
        </>
      )}
    </svg>
  );
}

export function AcademyMark({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 3.2h7.2A2.3 2.3 0 0 1 12.5 5.5V13H5.2A2.2 2.2 0 0 0 3 13.2V3.2z"
        {...stroke}
      />
      <path d="M3 13.2A2.2 2.2 0 0 1 5.2 11H12.5" {...stroke} />
    </svg>
  );
}
