import { cn } from "@/base/lib/cn";

type IconProps = {
  size?: number;
  className?: string;
  title?: string;
  strokeWidth?: number;
};

function IconBase({
  size = 24,
  className,
  title,
  strokeWidth = 2,
  children,
}: IconProps & { children: React.ReactNode }) {
  const labeled = Boolean(title);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden={labeled ? undefined : true}
      role={labeled ? "img" : undefined}
    >
      {labeled ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconWhitby(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 9.5 12 5l4 4.5" />
      <rect x="3" y="9" width="18" height="11" rx="4" />
      <path d="M3 14.5h18" />
    </IconBase>
  );
}

export function IconPortal(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h18M7 13h5" />
    </IconBase>
  );
}

export function IconAcademy(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5" />
    </IconBase>
  );
}

export function IconPartner(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="6.5" cy="12" r="3" />
      <circle cx="17.5" cy="6.5" r="3" />
      <circle cx="17.5" cy="17.5" r="3" />
      <path d="M9.2 10.7 14.8 8M9.2 13.3l5.6 2.7" />
    </IconBase>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </IconBase>
  );
}

export function IconClose(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </IconBase>
  );
}

export function IconSend(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </IconBase>
  );
}

export function IconAdd(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  );
}

export function IconArrow(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </IconBase>
  );
}

export function IconApproved(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3 4 6.5v5c0 4.5 3.4 8 8 9.5 4.6-1.5 8-5 8-9.5v-5L12 3Z" />
      <path d="M9 12l2 2 4-4" />
    </IconBase>
  );
}

export function IconMessage(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h16v10H9l-5 4V6Z" />
      <path d="M8 10.5h8" />
    </IconBase>
  );
}

export function IconDocument(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 4h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M14 4v5h5M9 14h6M9 17h4" />
    </IconBase>
  );
}

export const MODULE_ICONS = {
  whitby: IconWhitby,
  portal: IconPortal,
  academy: IconAcademy,
  partner: IconPartner,
} as const;

export const MODULE_TAB_META = {
  whitby: { label: "Whitby", hint: "Plan and run" },
  portal: { label: "Client Portal", hint: "What the principal sees" },
  academy: { label: "Academy", hint: "Credentials" },
  partner: { label: "Partner Center", hint: "Referrals" },
} as const;
