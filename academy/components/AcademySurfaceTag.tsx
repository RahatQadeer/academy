import { AcademyMark, AcademyRoleIcon } from "@/academy/components/AcademyRoleIcon";
import type { AcademyRole } from "@/academy/lib/types";
import { academyRoleTag, academyRoleTagStyle } from "@/academy/lib/surfacePath";

export function AcademySurfaceTag({
  role,
  className,
}: {
  role: AcademyRole;
  className?: string;
}) {
  const label = academyRoleTag(role);
  const colors = academyRoleTagStyle(role);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        borderRadius: 6,
        padding: "3px 7px 3px 3px",
        background: colors.background,
        color: colors.color,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${colors.color} 20%, transparent)`,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: 19,
          height: 19,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 4,
          background: "rgba(255,255,255,.62)",
          color: colors.color,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.4)",
        }}
      >
        <AcademyRoleIcon role={role} size={12} />
      </span>
      <span className="text-[10.5px] font-semibold leading-none tracking-[0.02em]">{label}</span>
    </span>
  );
}

export function AcademyProductMark({ compact }: { compact?: boolean }) {
  const size = compact ? 22 : 28;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: compact ? 7 : 9,
        background: "linear-gradient(180deg, #f3eff9 0%, var(--module-academy-bg) 100%)",
        color: "var(--module-academy-fg)",
        boxShadow: "inset 0 0 0 1px rgba(107, 79, 168, 0.14), 0 1px 2px rgba(107, 79, 168, 0.06)",
      }}
    >
      <AcademyMark size={compact ? 12 : 14} />
    </span>
  );
}
