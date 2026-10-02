import type { JSX, ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/base/lib/cn";
import type { SpecialtyIconKey } from "@/base/landing/content";
import { SECTION_IMAGES, type SectionImageKey } from "@/base/landing/images";

type IllustrationProps = {
  size?: number;
  className?: string;
  title?: string;
};

function IllustrationBase({
  size = 32,
  className,
  title,
  children,
}: IllustrationProps & { children: ReactNode }) {
  const labeled = Boolean(title);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-pa-ink", className)}
      aria-hidden={labeled ? undefined : true}
      role={labeled ? "img" : undefined}
    >
      {labeled ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

function PrincipalAffairs(props: IllustrationProps) {
  return (
    <IllustrationBase {...props} title={props.title ?? "Principal affairs"}>
      <rect x="5" y="7" width="22" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.35" />
      <path d="M5 12h22M11 5v4M21 5v4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M10 17h6M10 21h10" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.55" />
      <circle cx="22" cy="20" r="3" stroke="currentColor" strokeWidth="1.35" />
      <path d="M21 20l.75.75L23.5 18.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </IllustrationBase>
  );
}

function FamilyOffice(props: IllustrationProps) {
  return (
    <IllustrationBase {...props} title={props.title ?? "Family office operations"}>
      <path d="M16 6 6 11v12h20V11L16 6Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M12 23v-7h8v7" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M16 6v5M10 13h12M13 16h6" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.5" />
    </IllustrationBase>
  );
}

function ResidenceOps(props: IllustrationProps) {
  return (
    <IllustrationBase {...props} title={props.title ?? "Private residence operations"}>
      <path d="M6 14 16 7l10 7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 14v10h14V14" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <rect x="14" y="18" width="4" height="6" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="23" cy="22" r="2.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M23 20.5v3M21.8 22h2.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </IllustrationBase>
  );
}

function EstateLegacy(props: IllustrationProps) {
  return (
    <IllustrationBase {...props} title={props.title ?? "Estate and legacy operations"}>
      <path d="M8 24V12l8-5 8 5v12" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M8 24h16M12 24v-6h8v6" stroke="currentColor" strokeWidth="1.35" />
      <path d="M13 14h6M13 17h4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.55" />
    </IllustrationBase>
  );
}

function HealthMedical(props: IllustrationProps) {
  return (
    <IllustrationBase {...props} title={props.title ?? "Health and medical coordination"}>
      <rect x="6" y="8" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.35" />
      <path d="M16 12v8M12 16h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 13h20" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
      <path d="M9 24v2M23 24v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
    </IllustrationBase>
  );
}

function TravelMobility(props: IllustrationProps) {
  return (
    <IllustrationBase {...props} title={props.title ?? "Travel and global mobility"}>
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.35" />
      <path d="M7 16h18M16 7c3 2.5 3 14.5 0 18M16 7c-3 2.5-3 14.5 0 18" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <path d="M21 11 26 9l-2 5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </IllustrationBase>
  );
}

function SecurityRisk(props: IllustrationProps) {
  return (
    <IllustrationBase {...props} title={props.title ?? "Security and risk management"}>
      <path d="M16 5 8 9v7c0 5 3.5 7.5 8 10 4.5-2.5 8-5 8-10V9l-8-4Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M12 15.5 15 18.5 20 12.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </IllustrationBase>
  );
}

function HouseholdStaff(props: IllustrationProps) {
  return (
    <IllustrationBase {...props} title={props.title ?? "Household and staffing operations"}>
      <circle cx="11" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="21" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.35" />
      <path d="M6 24c0-3.5 2.5-5.5 5-5.5s5 2 5 5.5M16 24c0-3.5 2.5-5.5 5-5.5s5 2 5 5.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M16 8v3" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.45" />
    </IllustrationBase>
  );
}

const ILLUSTRATIONS: Record<
  SpecialtyIconKey,
  (props: IllustrationProps) => JSX.Element
> = {
  "principal-affairs": PrincipalAffairs,
  "family-office": FamilyOffice,
  residence: ResidenceOps,
  estate: EstateLegacy,
  health: HealthMedical,
  travel: TravelMobility,
  security: SecurityRisk,
  household: HouseholdStaff,
};

export function SpecialtyIllustration({
  icon,
  programTitle,
  size = 32,
  className,
}: {
  icon: SpecialtyIconKey;
  programTitle: string;
  size?: number;
  className?: string;
}) {
  const Illustration = ILLUSTRATIONS[icon];
  return (
    <Illustration size={size} className={className} title={programTitle} />
  );
}

const PREVIEW_PHOTOS: Record<SpecialtyIconKey, SectionImageKey> = {
  "principal-affairs": "coordination",
  "family-office": "partner",
  residence: "portal",
  estate: "principles",
  health: "academy",
  travel: "mobility",
  security: "principles",
  household: "portal",
};

function PreviewChrome({
  icon,
  children,
}: {
  icon: SpecialtyIconKey;
  children: ReactNode;
}) {
  const photo = SECTION_IMAGES[PREVIEW_PHOTOS[icon]];

  return (
    <div className="relative flex h-full min-h-[148px] flex-col overflow-hidden bg-neutral-200">
      <Image
        src={photo.src}
        alt=""
        aria-hidden
        fill
        sizes="(max-width: 1024px) 90vw, 320px"
        className="academy-preview-photo__img object-cover"
      />
      <div className="absolute inset-0 bg-white/82" aria-hidden />
      <div className="relative z-[1] flex flex-1 flex-col px-3 pb-2 pt-2.5">
        <div className="mb-2 flex items-center gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-neutral-400/80" />
          <span className="size-2 rounded-full bg-neutral-400/80" />
          <span className="size-2 rounded-full bg-neutral-400/80" />
        </div>
        <div className="flex flex-1 items-center justify-center rounded-lg border border-pa-line/80 bg-white/95 p-3 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

function SceneInner({ icon }: { icon: SpecialtyIconKey }) {
  switch (icon) {
    case "principal-affairs":
      return (
        <div className="w-full max-w-[200px] space-y-2">
          <div className="flex items-start gap-2 rounded-md border border-pa-line bg-pa-panel px-2.5 py-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-pa-ink/20 text-[9px] font-bold">
              ★
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="h-1.5 w-full rounded bg-pa-line" />
              <div className="h-1.5 w-4/5 rounded bg-pa-line/80" />
            </div>
          </div>
          <div className="relative ml-6 inline-flex rounded-full border border-pa-ink bg-pa-ink px-3 py-1 text-[10px] font-semibold text-white">
            View calendar
            <span className="absolute -bottom-2 -right-2 text-pa-ink" aria-hidden>
              ↘
            </span>
          </div>
        </div>
      );
    case "family-office":
      return (
        <div className="w-full max-w-[200px] space-y-1.5 text-[10px]">
          <div className="font-semibold text-pa-ink">Board packet</div>
          <div className="h-1.5 w-full rounded bg-pa-line" />
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded border border-pa-line py-2 text-center text-[9px] text-pa-muted">
                Q{i}
              </div>
            ))}
          </div>
        </div>
      );
    case "residence":
      return (
        <div className="w-full max-w-[200px]">
          <div className="mb-2 text-[10px] font-semibold">Residence opening</div>
          <div className="space-y-1.5">
            {["Staffing", "Vendors", "Provisioning"].map((row) => (
              <div key={row} className="flex items-center justify-between rounded border border-pa-line px-2 py-1 text-[9px]">
                <span>{row}</span>
                <span className="h-1.5 w-8 rounded bg-pa-line" />
              </div>
            ))}
          </div>
        </div>
      );
    case "estate":
      return (
        <div className="w-full max-w-[200px] space-y-2">
          <div className="text-[10px] font-semibold">Trustee coordination</div>
          <div className="rounded border border-dashed border-pa-ink/30 px-2 py-3 text-[9px] leading-snug text-pa-muted">
            Counsel review · Distribution schedule
          </div>
        </div>
      );
    case "health":
      return (
        <div className="w-full max-w-[200px]">
          <div className="mb-2 flex gap-1">
            <span className="rounded-full bg-pa-ink px-2 py-0.5 text-[9px] font-semibold text-white">
              Care team
            </span>
          </div>
          <div className="rounded-md border border-pa-line bg-pa-panel px-2 py-2 text-[9px] text-pa-muted">
            Schedule visit · Boundaries on
          </div>
        </div>
      );
    case "travel":
      return (
        <div className="w-full max-w-[200px] space-y-2">
          <div className="text-[10px] font-semibold">Relocation plan</div>
          <div className="inline-flex rounded-full border border-pa-ink bg-pa-ink px-3 py-1 text-[10px] font-semibold text-white">
            Generate itinerary
          </div>
        </div>
      );
    case "security":
      return (
        <div className="w-full max-w-[200px] space-y-2">
          <div className="rounded border border-pa-line px-2 py-1.5 text-[9px]">
            <span className="font-semibold">Risk brief</span>
            <div className="mt-1 h-1 w-full rounded bg-pa-line" />
          </div>
          <div className="text-[9px] text-pa-muted">Escalation path ready</div>
        </div>
      );
    case "household":
      return (
        <div className="w-full max-w-[200px]">
          <div className="mb-1.5 text-[10px] font-semibold">Staff roster</div>
          {["House manager", "Chef"].map((role) => (
            <div key={role} className="mb-1 flex items-center gap-2 text-[9px]">
              <span className="h-4 w-4 rounded-full border border-pa-line" />
              {role}
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export function SpecialtyPreviewScene({ icon }: { icon: SpecialtyIconKey }) {
  return (
    <PreviewChrome icon={icon}>
      <SceneInner icon={icon} />
    </PreviewChrome>
  );
}
