import { cn } from "@/base/lib/cn";
import { COMPLETION_CERTIFICATE } from "../lib/certificateConfig";
import { formatCertificateName } from "../utils/presentation";

/**
 * Specialty Endorsement — distinct from CPA / Completion.
 * Left specialty band + parchment field, copper medallion, heraldic seal.
 */
const INK = "#16131f";
const INK_SOFT = "#3a3448";
const COPPER = "#b87333";
const COPPER_LIGHT = "#e0b87a";
const COPPER_DARK = "#7a4a1e";
const SLATE = "#1e2433";
const SLATE_MID = "#2a3142";
const PARCHMENT = "#faf6ef";
const PARCHMENT_WARM = "#f3ebe0";
const MUTED = "#6e6778";
const SCRIPT =
  '"Segoe Script", "Snell Roundhand", "Brush Script MT", "Apple Chancery", "Lucida Handwriting", cursive';
const SANS = 'Arial, "Helvetica Neue", Helvetica, ui-sans-serif, system-ui, sans-serif';
const SERIF = 'Georgia, "Times New Roman", Times, serif';

export type EndorsementCertificateProps = {
  learnerName: string;
  programName: string;
  issuedOn: string;
  credentialId?: string;
  className?: string;
};

export function EndorsementCertificateTemplate({
  learnerName,
  programName,
  issuedOn,
  credentialId,
  className,
}: EndorsementCertificateProps) {
  const org = COMPLETION_CERTIFICATE.organizationName;
  const displayName = formatCertificateName(learnerName);

  return (
    <div
      className={cn("certificate-sheet relative mx-auto select-none overflow-hidden", className)}
      style={{
        aspectRatio: "1024 / 729",
        background: PARCHMENT,
        boxShadow: "0 2px 0 rgba(22,19,31,0.06), 0 16px 44px rgba(22,19,31,0.16)",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        color: INK,
        fontFamily: SANS,
      }}
    >
      <EndorsementDecor />

      {/* Left specialty band copy */}
      <div
        className="absolute z-[2] flex flex-col items-center justify-between"
        style={{
          left: 0,
          top: 0,
          bottom: 0,
          width: "14.5%",
          padding: "7% 0 6%",
          color: COPPER_LIGHT,
        }}
      >
        <p
          style={{
            margin: 0,
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontFamily: SERIF,
            fontSize: "clamp(0.55rem, 1.05vw, 0.72rem)",
            fontWeight: 700,
            letterSpacing: "0.42em",
            textTransform: "uppercase",
            color: COPPER_LIGHT,
          }}
        >
          Specialty Credential
        </p>
        <p
          style={{
            margin: 0,
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: "clamp(0.48rem, 0.9vw, 0.62rem)",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(224,184,122,0.65)",
          }}
        >
          {org}
        </p>
      </div>

      {/* Main parchment content */}
      <div
        className="absolute z-[1] flex flex-col"
        style={{
          left: "14.5%",
          right: 0,
          top: 0,
          bottom: 0,
          padding: "5.5% 7.5% 4.5% 6.5%",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: "clamp(0.55rem, 1.05vw, 0.72rem)",
                fontWeight: 700,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                color: COPPER_DARK,
              }}
            >
              {org} Academy
            </p>
            <p
              style={{
                margin: "0.85rem 0 0",
                fontSize: "clamp(1.05rem, 2.35vw, 1.55rem)",
                fontWeight: 800,
                letterSpacing: "0.16em",
                lineHeight: 1.1,
                color: INK,
              }}
            >
              SPECIALTY
            </p>
            <p
              style={{
                margin: "0.2rem 0 0",
                fontSize: "clamp(0.88rem, 1.95vw, 1.28rem)",
                fontWeight: 700,
                letterSpacing: "0.22em",
                lineHeight: 1.1,
                color: INK_SOFT,
              }}
            >
              ENDORSEMENT
            </p>
          </div>

          {/* Copper medallion */}
          <div
            className="relative shrink-0"
            style={{ width: "clamp(4.2rem, 9.5vw, 5.8rem)", aspectRatio: "1" }}
            aria-hidden
          >
            <svg viewBox="0 0 120 120" className="h-full w-full">
              <defs>
                <radialGradient id="seMedal" cx="38%" cy="32%" r="68%">
                  <stop offset="0%" stopColor={COPPER_LIGHT} />
                  <stop offset="55%" stopColor={COPPER} />
                  <stop offset="100%" stopColor={COPPER_DARK} />
                </radialGradient>
              </defs>
              <circle cx="60" cy="60" r="56" fill="none" stroke={COPPER_DARK} strokeWidth="2.5" />
              <circle cx="60" cy="60" r="50" fill="url(#seMedal)" />
              <circle
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.2"
              />
              <polygon
                points="60,28 66,48 88,48 70,60 76,80 60,68 44,80 50,60 32,48 54,48"
                fill="rgba(255,255,255,0.92)"
              />
              <text
                x="60"
                y="102"
                textAnchor="middle"
                fontFamily={SANS}
                fontSize="9"
                fontWeight={700}
                letterSpacing="1.5"
                fill="rgba(255,255,255,0.9)"
              >
                SE
              </text>
            </svg>
          </div>
        </div>

        <div
          style={{
            marginTop: "0.85rem",
            height: 1.5,
            width: "100%",
            background: `linear-gradient(90deg, ${COPPER}, ${COPPER_LIGHT} 40%, transparent)`,
          }}
        />

        <p
          style={{
            margin: "1.15rem 0 0",
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
            margin: "0.4rem 0 0",
            fontFamily: SCRIPT,
            fontSize: "clamp(1.85rem, 4.5vw, 2.85rem)",
            lineHeight: 1.05,
            color: INK,
          }}
        >
          {displayName}
        </p>

        <p
          style={{
            margin: "0.95rem 0 0",
            fontSize: "clamp(0.72rem, 1.25vw, 0.88rem)",
            lineHeight: 1.5,
            color: INK_SOFT,
            maxWidth: "34rem",
          }}
        >
          has earned the Specialty Endorsement recognizing applied competence in
        </p>

        {/* Specialty track panel — unique to SE */}
        <div
          style={{
            marginTop: "0.7rem",
            alignSelf: "flex-start",
            padding: "0.55rem 1.1rem",
            borderLeft: `3px solid ${COPPER}`,
            background: `linear-gradient(90deg, ${PARCHMENT_WARM}, transparent)`,
            maxWidth: "min(100%, 28rem)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "clamp(0.5rem, 0.88vw, 0.62rem)",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: COPPER_DARK,
            }}
          >
            Endorsed specialty
          </p>
          <p
            style={{
              margin: "0.2rem 0 0",
              fontFamily: SERIF,
              fontSize: "clamp(0.92rem, 1.65vw, 1.15rem)",
              fontWeight: 700,
              lineHeight: 1.25,
              color: INK,
            }}
          >
            {programName}
          </p>
        </div>

        <p
          style={{
            margin: "0.85rem 0 0",
            fontSize: "clamp(0.62rem, 1.1vw, 0.78rem)",
            lineHeight: 1.45,
            color: MUTED,
            maxWidth: "32rem",
          }}
        >
          Independent of Certified Private Attaché. Awarded this {issuedOn}.
        </p>

        <div
          className="mt-auto flex w-full items-end justify-between gap-6"
          style={{ paddingTop: "1.2rem" }}
        >
          <SignatureBlock
            script={COMPLETION_CERTIFICATE.signerName}
            name={COMPLETION_CERTIFICATE.signerName}
            title={COMPLETION_CERTIFICATE.signerTitle}
            rule={COPPER}
            muted={MUTED}
          />
          <SignatureBlock
            script={org}
            name={org}
            title="Awarding Academy"
            rule={COPPER}
            muted={MUTED}
            align="right"
          />
        </div>

        {credentialId ? (
          <p
            style={{
              margin: "0.65rem 0 0",
              fontSize: "clamp(0.48rem, 0.85vw, 0.6rem)",
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

function SignatureBlock({
  script,
  name,
  title,
  rule,
  muted,
  align = "left",
}: {
  script: string;
  name: string;
  title: string;
  rule: string;
  muted: string;
  align?: "left" | "right";
}) {
  return (
    <div style={{ textAlign: align, minWidth: "8.5rem" }}>
      <p
        style={{
          margin: 0,
          fontFamily: SCRIPT,
          fontSize: "clamp(0.95rem, 1.75vw, 1.22rem)",
          lineHeight: 1,
        }}
      >
        {script}
      </p>
      <div
        style={{
          marginTop: "0.22rem",
          marginLeft: align === "right" ? "auto" : 0,
          height: 1.5,
          width: "8.5rem",
          background: rule,
        }}
      />
      <p style={{ margin: "0.35rem 0 0", fontSize: "clamp(0.64rem, 1.1vw, 0.78rem)", fontWeight: 700 }}>
        {name}
      </p>
      <p
        style={{
          margin: "0.1rem 0 0",
          fontSize: "clamp(0.52rem, 0.9vw, 0.66rem)",
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

function EndorsementDecor() {
  const w = 1024;
  const h = 729;
  const bandW = Math.round(w * 0.145);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id="seBand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={SLATE_MID} />
          <stop offset="100%" stopColor={SLATE} />
        </linearGradient>
        <linearGradient id="seCopperRule" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COPPER_LIGHT} />
          <stop offset="50%" stopColor={COPPER} />
          <stop offset="100%" stopColor={COPPER_DARK} />
        </linearGradient>
        <linearGradient id="sePaper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PARCHMENT} />
          <stop offset="100%" stopColor={PARCHMENT_WARM} />
        </linearGradient>
      </defs>

      {/* Outer frame */}
      <rect x="0" y="0" width={w} height={h} fill={SLATE} />
      <rect x="10" y="10" width={w - 20} height={h - 20} fill="url(#sePaper)" />

      {/* Left specialty band */}
      <rect x="10" y="10" width={bandW} height={h - 20} fill="url(#seBand)" />
      <rect
        x={10 + bandW - 3}
        y="10"
        width="3"
        height={h - 20}
        fill="url(#seCopperRule)"
      />

      {/* Subtle inner rule on parchment */}
      <rect
        x={10 + bandW + 14}
        y="24"
        width={w - bandW - 48}
        height={h - 48}
        fill="none"
        stroke={COPPER}
        strokeWidth="1"
        opacity="0.35"
      />
      <rect
        x={10 + bandW + 20}
        y="30"
        width={w - bandW - 60}
        height={h - 60}
        fill="none"
        stroke={INK}
        strokeWidth="0.6"
        opacity="0.18"
      />

      {/* Band chevron ornaments */}
      <g transform={`translate(${10 + bandW / 2}, ${h / 2})`} opacity="0.2">
        <path
          d="M-18 -48 L0 -28 L18 -48 M-18 -32 L0 -12 L18 -32 M-18 12 L0 32 L18 12 M-18 28 L0 48 L18 28"
          fill="none"
          stroke={COPPER_LIGHT}
          strokeWidth="1.4"
          strokeLinecap="square"
        />
      </g>

      {/* Soft watermark on parchment */}
      <g transform={`translate(${bandW + (w - bandW) / 2 + 5}, ${h / 2 + 20})`} opacity="0.055">
        <circle r="88" fill="none" stroke={COPPER} strokeWidth="2.5" />
        <circle r="74" fill="none" stroke={INK} strokeWidth="1.2" />
        <polygon
          points="0,-36 11,-11 36,-11 15,4 23,28 0,14 -23,28 -15,4 -36,-11 -11,-11"
          fill="none"
          stroke={COPPER}
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
