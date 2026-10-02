import type { IntegrationKey } from "@/client-portal/types";

/**
 * Each service by its own logo — the paths and brand colours of Whitby's
 * `ProviderMark`, so a client sees the same mark their adviser sees, and the
 * one Google and Microsoft use everywhere else.
 */
const MARKS: Record<IntegrationKey, React.ReactNode> = {
  google_calendar: (
    <>
      <rect x="4" y="6" width="40" height="38" rx="4" fill="#fff" stroke="#dadce0" strokeWidth="1" />
      <rect x="4" y="6" width="40" height="10" fill="#4285F4" rx="4" />
      <rect x="10" y="20" width="8" height="8" fill="#34A853" />
      <rect x="20" y="20" width="8" height="8" fill="#FBBC05" />
      <rect x="30" y="20" width="8" height="8" fill="#EA4335" />
      <rect x="10" y="30" width="8" height="8" fill="#4285F4" />
    </>
  ),
  outlook_calendar: (
    <>
      <rect width="48" height="48" rx="8" fill="#0078D4" />
      <rect x="10" y="10" width="28" height="24" rx="2" fill="#fff" />
      <rect x="10" y="10" width="28" height="6" fill="#0078D4" />
      <text x="24" y="30" fontSize="14" fontWeight="700" fill="#0078D4" textAnchor="middle">
        31
      </text>
    </>
  ),
  gmail: (
    <>
      <rect width="48" height="48" rx="8" fill="#fff" />
      <path
        fill="#4285F4"
        d="M6 14v20a4 4 0 004 4h4V20l10 8 10-8v18h4a4 4 0 004-4V14a4 4 0 00-6.4-3.2L24 21 10.4 10.8A4 4 0 004 14z"
      />
      <path fill="#EA4335" d="M6 14l18 13.5L42 14a4 4 0 00-4-4H10a4 4 0 00-4 4z" />
    </>
  ),
  outlook_mail: (
    <>
      <rect width="48" height="48" rx="8" fill="#0078D4" />
      <rect x="9" y="14" width="30" height="20" rx="2" fill="#fff" />
      <path fill="#0078D4" d="M9 16l15 11 15-11v-1a1 1 0 00-1-1H10a1 1 0 00-1 1z" />
    </>
  ),
};

export function ProviderMark({
  provider,
  size = 34,
}: {
  provider: IntegrationKey;
  size?: number;
}) {
  // Whitby's tile: 34px, an 8px corner, a 20px drawing. A hairline stands in
  // for its tinted grounds, since every mark here is drawn on white.
  const drawing = Math.round(size * 0.59);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[8px] border"
      style={{
        width: size,
        height: size,
        background: "#ffffff",
        borderColor: "var(--border)",
      }}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" width={drawing} height={drawing}>
        {MARKS[provider]}
      </svg>
    </span>
  );
}
