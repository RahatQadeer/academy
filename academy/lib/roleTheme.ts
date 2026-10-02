import type { CSSProperties } from "react";
import type { AcademyRole } from "./types";

/**
 * Light, professional role palettes. Built from design-system tokens:
 * learner uses success green, admin uses the platform accent blue,
 * instructor uses a muted professional blue so staff surfaces stay light.
 * Super Admin uses Academy purple so it reads as a higher staff tier.
 */
export type AcademyRoleTheme = {
  accent: string;
  accentHover: string;
  tint: string;
  tintMid: string;
  tintSoft: string;
};

export const ACADEMY_ROLE_THEME: Record<AcademyRole, AcademyRoleTheme> = {
  learner: {
    accent: "#1c7a52",
    accentHover: "#166344",
    tint: "#e8f4ec",
    tintMid: "#f3faf5",
    tintSoft: "#f8fcf9",
  },
  admin: {
    accent: "#2383e2",
    accentHover: "#1a6bbd",
    tint: "#e7f1fb",
    tintMid: "#f4f9fe",
    tintSoft: "#fbfdff",
  },
  instructor: {
    accent: "#3d6a8c",
    accentHover: "#2d4a5e",
    tint: "#e8f0f6",
    tintMid: "#f3f7fb",
    tintSoft: "#f8fbfd",
  },
  super_admin: {
    accent: "#6b4fa8",
    accentHover: "#5a4190",
    tint: "#e9e4f3",
    tintMid: "#f3f0f8",
    tintSoft: "#f8f6fb",
  },
};

export function academyRoleCssVars(role: AcademyRole): CSSProperties {
  const theme = ACADEMY_ROLE_THEME[role];
  return {
    "--accent": theme.accent,
    "--accent-hover": theme.accentHover,
    "--accent-tint": theme.tint,
    "--accent-tint-mid": theme.tintMid,
    "--accent-tint-soft": theme.tintSoft,
  } as CSSProperties;
}
