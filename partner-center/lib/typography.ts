/**
 * Locked Partner Center type scale (partner + super-admin).
 * Prefer these over inventing new text-[Npx] steps.
 */
export const pcType = {
  /** Rare full-bleed status / hero */
  display: "text-[24px] font-bold tracking-[-0.4px]",
  /** Shell page title — Whitby-like list-screen weight */
  page: "text-[22px] font-bold leading-[1.15] tracking-[-0.35px] lg:text-[24px]",
  /** Fixed 20px page title (in-pane, already large context) */
  pageFixed: "text-[20px] font-bold leading-none tracking-[-0.3px]",
  /** Thread / card / section title */
  title: "text-[16px] font-bold tracking-[-0.2px]",
  /** Shell subtitle, supporting line under a title */
  subtitle: "text-[13.5px] font-normal leading-[1.45]",
  /** Default UI copy, table cells, list rows */
  body: "text-[13.5px] font-normal",
  /** Emphasized row / primary label in dense UI */
  bodyStrong: "text-[13.5px] font-semibold",
  /** Medium-weight body (nav, secondary actions) */
  bodyMedium: "text-[13.5px] font-medium",
  /** Buttons, chips — 14px */
  control: "text-[14px] font-medium",
  /** Inputs matching design-system 14.5px */
  controlInput: "text-[14.5px] font-normal",
  /** Form labels, filter captions */
  label: "text-[12.5px] font-medium",
  /** Timestamps, unread counts, helpers under titles */
  meta: "text-[11.5px] font-normal",
  /** Meta with slight emphasis */
  metaMedium: "text-[11.5px] font-medium",
  /** Pills, bubble clock, micro badges */
  micro: "text-[10.5px] font-medium",
} as const;

export type PcTypeKey = keyof typeof pcType;
