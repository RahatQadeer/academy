import type { ProviderKey } from "@/whitbyos/lib/integrations";

/**
 * Screen 16 draws each app by its own logo, not by a letter.
 *
 * The seven the export ships are traced from it: same viewBox, same paths,
 * same brand colours, in the same 34px tile with the same 20px drawing inside.
 * Outlook Mail and Stripe are not on that export because it does not list
 * them; theirs are drawn in the same idiom so the row does not fall back to a
 * letter beside eight logos.
 */

/** The tile behind the logo. The export tints two of them and leaves the rest white. */
const TILE: Partial<Record<ProviderKey, string>> = {
  outlook_calendar: "#f0f4f9",
  outlook_mail: "#f0f4f9",
  slack: "#f4f4f8",
};

const MARKS: Record<ProviderKey, React.ReactNode> = {
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
  google_drive: (
    <>
      <path fill="#0F9D58" d="M17 6l-11 19 6 10h10L33 6z" />
      <path fill="#FFCF63" d="M17 6h14l11 19H28z" />
      <path fill="#4285F4" d="M6 25l6 10h20l6-10H12z" />
    </>
  ),
  slack: (
    <>
      <rect width="48" height="48" rx="8" fill="#fff" />
      <path fill="#36C5F0" d="M19 6a3 3 0 013 3v9a3 3 0 01-6 0V9a3 3 0 013-3z" />
      <path fill="#2EB67D" d="M9 17a3 3 0 013-3h9a3 3 0 010 6h-9a3 3 0 01-3-3z" />
      <path fill="#ECB22E" d="M29 29a3 3 0 01-3-3v-9a3 3 0 016 0v9a3 3 0 01-3 3z" />
      <path fill="#E01E5A" d="M39 19a3 3 0 01-3 3h-9a3 3 0 010-6h9a3 3 0 013 3z" />
    </>
  ),
  quickbooks: (
    <>
      <rect width="48" height="48" rx="24" fill="#2CA01C" />
      <path
        fill="#fff"
        d="M15 17h4v14h-4a7 7 0 010-14zm14 0h4v20h-4a3 3 0 01-3-3V20a3 3 0 013-3zm-7 0h3v20h-3a3 3 0 01-3-3v-4h3v4a0 0 0 000 0V17z"
      />
    </>
  ),
  outlook_mail: (
    <>
      <rect width="48" height="48" rx="8" fill="#0078D4" />
      <rect x="9" y="14" width="30" height="20" rx="2" fill="#fff" />
      <path fill="#0078D4" d="M9 16l15 11 15-11v-1a1 1 0 00-1-1H10a1 1 0 00-1 1z" />
    </>
  ),
  stripe: (
    <>
      <rect width="48" height="48" rx="8" fill="#635BFF" />
      <path
        fill="#fff"
        d="M23.4 20.4c0-1 .9-1.5 2.2-1.5 2 0 4.5.6 6.5 1.7v-5.5a17 17 0 00-6.5-1.2c-5.3 0-8.8 2.8-8.8 7.4 0 7.2 9.9 6 9.9 9.1 0 1.2-1 1.6-2.4 1.6-2.2 0-5-.9-7.2-2.1v5.6c2.4 1 4.9 1.5 7.2 1.5 5.4 0 9.2-2.7 9.2-7.4 0-7.7-9.9-6.3-9.9-9.2z"
      />
    </>
  ),
};

export function ProviderMark({
  provider,
  size = 34,
}: {
  provider: ProviderKey;
  size?: number;
}) {
  const drawing = Math.round(size * (20 / 34));

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[8px]"
      style={{
        background: TILE[provider] ?? "#ffffff",
        width: size,
        height: size,
      }}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" width={drawing} height={drawing}>
        {MARKS[provider]}
      </svg>
    </span>
  );
}
