import { cn } from "@/base/lib/cn";
import { COMPLETION_CERTIFICATE } from "../lib/certificateConfig";
import { formatCertificateName } from "../utils/presentation";

/**
 * CPA — classic prestige certificate.
 * Cream field, gold ornamental frame, centered script name.
 */
const INK = "#1a1430";
const INK_SOFT = "#3d2f5c";
const GOLD = "#c9a227";
const GOLD_LIGHT = "#e8d48b";
const GOLD_DARK = "#8a6b12";
const CREAM = "#faf7f0";
const MUTED = "#6b6578";
const SCRIPT =
  '"Segoe Script", "Snell Roundhand", "Brush Script MT", "Apple Chancery", "Lucida Handwriting", cursive';
const SANS = 'Arial, "Helvetica Neue", Helvetica, ui-sans-serif, system-ui, sans-serif';
const SERIF = 'Georgia, "Times New Roman", Times, serif';

export type ProfessionalCertificationProps = {
  learnerName: string;
  programName: string;
  issuedOn: string;
  credentialId?: string;
  className?: string;
};

export function ProfessionalCertificationTemplate({
  learnerName,
  programName,
  issuedOn,
  credentialId,
  className,
}: ProfessionalCertificationProps) {
  const org = COMPLETION_CERTIFICATE.organizationName;
  const displayName = formatCertificateName(learnerName);

  return (
    <div
      className={cn("certificate-sheet relative mx-auto select-none overflow-hidden", className)}
      style={{
        aspectRatio: "1024 / 729",
        background: CREAM,
        boxShadow: "0 2px 0 rgba(26,20,48,0.06), 0 16px 44px rgba(26,20,48,0.16)",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        color: INK,
        fontFamily: SANS,
      }}
    >
      <ProfessionalDecor />

      <div
        className="absolute inset-0 z-[1] flex flex-col items-center text-center"
        style={{ padding: "5.2% 11% 5%" }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: "clamp(0.58rem, 1.15vw, 0.78rem)",
            fontWeight: 700,
            letterSpacing: "0.38em",
            textTransform: "uppercase",
            color: GOLD_DARK,
            paddingLeft: "0.38em",
          }}
        >
          {org} Academy
        </p>

        <div
          style={{
            marginTop: "0.55rem",
            height: 1.5,
            width: "4.5rem",
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
          }}
        />

        <p
          style={{
            margin: "0.95rem 0 0",
            fontSize: "clamp(1.15rem, 2.6vw, 1.7rem)",
            fontWeight: 800,
            letterSpacing: "0.22em",
            lineHeight: 1.05,
            paddingLeft: "0.22em",
            color: INK,
          }}
        >
          PROFESSIONAL
        </p>
        <p
          style={{
            margin: "0.28rem 0 0",
            fontSize: "clamp(0.95rem, 2.15vw, 1.4rem)",
            fontWeight: 700,
            letterSpacing: "0.28em",
            lineHeight: 1.1,
            paddingLeft: "0.28em",
            color: INK_SOFT,
          }}
        >
          CERTIFICATION
        </p>

        <p
          style={{
            margin: "1.05rem 0 0",
            fontFamily: SERIF,
            fontSize: "clamp(0.68rem, 1.2vw, 0.84rem)",
            fontStyle: "italic",
            color: MUTED,
          }}
        >
          This is to certify that
        </p>

        <p
          style={{
            margin: "0.45rem 0 0",
            fontFamily: SCRIPT,
            fontSize: "clamp(1.9rem, 4.7vw, 2.95rem)",
            lineHeight: 1.05,
            color: INK,
          }}
        >
          {displayName}
        </p>

        <div
          style={{
            marginTop: "0.45rem",
            height: 1.5,
            width: "min(48%, 16rem)",
            background: `linear-gradient(90deg, transparent, ${GOLD} 15%, ${GOLD} 85%, transparent)`,
          }}
        />

        <p
          style={{
            margin: "0.95rem 0 0",
            maxWidth: "36rem",
            fontSize: "clamp(0.72rem, 1.28vw, 0.9rem)",
            lineHeight: 1.55,
            color: INK_SOFT,
          }}
        >
          has been awarded the professional certification{" "}
          <strong style={{ color: INK }}>&ldquo;{programName}&rdquo;</strong>, recognizing
          completion of the Certified Private Attaché requirements of {org} Academy.
        </p>

        <p
          style={{
            margin: "0.85rem 0 0",
            fontSize: "clamp(0.7rem, 1.2vw, 0.86rem)",
            fontWeight: 700,
            letterSpacing: "0.02em",
          }}
        >
          Awarded this {issuedOn}
        </p>

        <div
          className="mt-auto flex w-full items-end justify-between gap-8"
          style={{ maxWidth: "40rem", paddingTop: "1.6rem" }}
        >
          <Sig align="left" script={COMPLETION_CERTIFICATE.signerName} name={COMPLETION_CERTIFICATE.signerName} title={COMPLETION_CERTIFICATE.signerTitle} rule={GOLD} muted={MUTED} />
          <Sig align="right" script={org} name={org} title="Awarding Academy" rule={GOLD} muted={MUTED} />
        </div>

        {credentialId ? (
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "clamp(0.5rem, 0.88vw, 0.62rem)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            Certificate ID · {credentialId}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Sig({
  script,
  name,
  title,
  align,
  rule,
  muted,
}: {
  script: string;
  name: string;
  title: string;
  align: "left" | "right";
  rule: string;
  muted: string;
}) {
  return (
    <div style={{ textAlign: align, minWidth: "9rem" }}>
      <p style={{ margin: 0, fontFamily: SCRIPT, fontSize: "clamp(1rem, 1.85vw, 1.3rem)", lineHeight: 1 }}>
        {script}
      </p>
      <div
        style={{
          marginTop: "0.25rem",
          marginLeft: align === "right" ? "auto" : 0,
          height: 1.5,
          width: "9.5rem",
          background: rule,
        }}
      />
      <p style={{ margin: "0.4rem 0 0", fontSize: "clamp(0.68rem, 1.15vw, 0.82rem)", fontWeight: 700 }}>{name}</p>
      <p
        style={{
          margin: "0.12rem 0 0",
          fontSize: "clamp(0.56rem, 0.95vw, 0.7rem)",
          color: muted,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </p>
    </div>
  );
}

function ProfessionalDecor() {
  const w = 1024;
  const h = 729;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id="pcBorder" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD_LIGHT} />
          <stop offset="50%" stopColor={GOLD} />
          <stop offset="100%" stopColor={GOLD_DARK} />
        </linearGradient>
      </defs>
      <rect x="18" y="18" width={w - 36} height={h - 36} fill="none" stroke={INK} strokeWidth="2.5" />
      <rect x="28" y="28" width={w - 56} height={h - 56} fill="none" stroke="url(#pcBorder)" strokeWidth="2" />
      <rect x="36" y="36" width={w - 72} height={h - 72} fill="none" stroke={INK} strokeWidth="0.75" opacity="0.35" />
      {[
        [44, 44, 1, 1],
        [w - 44, 44, -1, 1],
        [44, h - 44, 1, -1],
        [w - 44, h - 44, -1, -1],
      ].map(([cx, cy, sx, sy], i) => (
        <g key={i} transform={`translate(${cx},${cy}) scale(${sx},${sy})`}>
          <path d="M0 0 H42 M0 0 V42 M8 8 H34 M8 8 V34" fill="none" stroke={GOLD} strokeWidth="1.6" strokeLinecap="square" />
          <circle cx="0" cy="0" r="3" fill={GOLD} />
        </g>
      ))}
      <g transform={`translate(${w / 2}, ${h / 2 + 8})`} opacity="0.07">
        <circle r="92" fill="none" stroke={GOLD} strokeWidth="3" />
        <circle r="78" fill="none" stroke={INK} strokeWidth="1.5" />
        <text textAnchor="middle" y="14" fontFamily={SERIF} fontWeight={700} fontSize="42" fill={INK} letterSpacing="3">
          CPA
        </text>
      </g>
    </svg>
  );
}
