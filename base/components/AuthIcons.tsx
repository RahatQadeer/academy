/**
 * The small marks the sign-in screens use inside and beside their fields.
 *
 * Drawn rather than pulled from an icon package: five glyphs do not justify a
 * dependency, and these have to sit at 16px against a 38px control without the
 * optical weight fight that a general-purpose set brings. `currentColor`
 * throughout, so a field decides its own state and the icon follows.
 */

type IconProps = { size?: number; className?: string };

export function MailIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 7 8.1 5.6a1.6 1.6 0 0 0 1.8 0L21 7" />
    </svg>
  );
}

export function LockIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
      <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
    </svg>
  );
}

export function UserIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

/** Shown while the password is hidden: pressing it reveals. */
export function EyeIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.2 12S5.8 5.5 12 5.5 21.8 12 21.8 12 18.2 18.5 12 18.5 2.2 12 2.2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Shown while the password is visible: pressing it hides. */
export function EyeOffIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6.2 0 9.8 6.5 9.8 6.5a17 17 0 0 1-2.9 3.7" />
      <path d="M6.4 6.8A16.7 16.7 0 0 0 2.2 12S5.8 18.5 12 18.5c1.7 0 3.2-.5 4.5-1.2" />
      <path d="M10 10a2.8 2.8 0 0 0 4 4" />
      <path d="m3.5 3.5 17 17" />
    </svg>
  );
}

/** Sits in a failure notice; also the mark beside an unmet password rule. */
export function AlertIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.6v5.2" />
      <path d="M12 16.2h.01" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none"
         stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}
