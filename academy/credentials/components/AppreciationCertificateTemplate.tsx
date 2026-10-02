import { cn } from "@/base/lib/cn";
import { COMPLETION_CERTIFICATE } from "../lib/certificateConfig";
import { formatCertificateName } from "../utils/presentation";

/**
 * Certificate of Completion — professional split layout.
 * Distinct from CPA (classic centered diploma) and SE (copper specialty band),
 * but restrained: quiet navy panel, cream field, serif name, dual signatures.
 */
const INK = "#1c2430";
const INK_SOFT = "#3d4a5c";
const NAVY = "#1a2744";
const NAVY_MID = "#243556";
const TEAL = "#2a7a72";
const TEAL_SOFT = "#d8ebe8";
const CREAM = "#faf9f6";
const MUTED = "#6b7280";
const SANS = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", Times, serif';

export type AppreciationCertificateProps = {
  learnerName: string;
  programName: string;
  issuedOn: string;
  credentialId?: string;
  className?: string;
};

export function AppreciationCertificateTemplate({
  learnerName,
  programName,
  issuedOn,
  credentialId,
  className,
}: AppreciationCertificateProps) {
  const org = COMPLETION_CERTIFICATE.organizationName;
  const displayName = formatCertificateName(learnerName);

  return (
    <div
      className={cn("certificate-sheet relative mx-auto select-none overflow-hidden", className)}
      style={{
        aspectRatio: "1024 / 729",
        background: CREAM,
        boxShadow: "0 2px 0 rgba(28,36,48,0.04), 0 18px 40px rgba(28,36,48,0.12)",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        color: INK,
        fontFamily: SANS,
      }}
    >
      {/* Outer professional frame */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          border: `1.5px solid ${NAVY}`,
          margin: "10px",
          opacity: 0.9,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          border: `0.75px solid ${TEAL}`,
          margin: "16px",
          opacity: 0.35,
        }}
        aria-hidden
      />

      {/* Left navy panel */}
      <div
        className="absolute inset-y-0 left-0 z-0"
        style={{
          width: "27%",
          background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_MID} 100%)`,
        }}
      />
      <div
        className="absolute inset-y-0 z-0"
        style={{
          left: "27%",
          width: 3,
          background: TEAL,
        }}
      />

      {/* Left panel content */}
      <div
        className="absolute z-[1] flex flex-col"
        style={{
          left: 0,
          top: 0,
          bottom: 0,
          width: "27%",
          padding: "7% 4% 6% 5%",
          color: "#f5f3ef",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: "clamp(0.55rem, 1vw, 0.72rem)",
            fontWeight: 700,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            opacity: 0.75,
          }}
        >
          {org}
        </p>
        <p
          style={{
            margin: "0.4rem 0 0",
            fontSize: "clamp(0.78rem, 1.4vw, 0.98rem)",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          Academy
        </p>

        <div
          style={{
            marginTop: "1.4rem",
            width: "2.25rem",
            height: 1,
            background: "rgba(245,243,239,0.35)",
          }}
        />

        <div className="mt-auto">
          {/* Refined mark — ring + check */}
          <svg
            width="56"
            height="56"
            viewBox="0 0 56 56"
            aria-hidden
            style={{ marginBottom: "1rem", display: "block" }}
          >
            <circle cx="28" cy="28" r="26" fill="none" stroke="rgba(245,243,239,0.25)" strokeWidth="1.5" />
            <circle cx="28" cy="28" r="20" fill="none" stroke={TEAL} strokeWidth="1.75" />
            <path
              d="M18 28.5 L24.5 35 L38 20"
              fill="none"
              stroke="#f5f3ef"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: "clamp(0.95rem, 1.7vw, 1.2rem)",
              fontWeight: 700,
              letterSpacing: "0.01em",
              lineHeight: 1.2,
            }}
          >
            Course
            <br />
            Completion
          </p>
          <p
            style={{
              margin: "0.7rem 0 0",
              fontSize: "clamp(0.52rem, 0.9vw, 0.64rem)",
              lineHeight: 1.45,
              opacity: 0.6,
              letterSpacing: "0.04em",
            }}
          >
            Official record of
            <br />
            academic achievement
          </p>
        </div>
      </div>

      {/* Right content */}
      <div
        className="absolute z-[1] flex flex-col"
        style={{
          left: "27%",
          right: 0,
          top: 0,
          bottom: 0,
          padding: "6.5% 7% 5.5% 5.5%",
          background: CREAM,
        }}
      >
        <div className="flex items-baseline justify-between gap-4">
          <p
            style={{
              margin: 0,
              fontSize: "clamp(0.55rem, 0.98vw, 0.7rem)",
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: TEAL,
            }}
          >
            Certificate of Completion
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "clamp(0.58rem, 1vw, 0.72rem)",
              color: MUTED,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            {issuedOn}
          </p>
        </div>

        <div
          style={{
            marginTop: "0.85rem",
            height: 1,
            background: `linear-gradient(90deg, ${TEAL}, transparent)`,
            opacity: 0.45,
          }}
        />

        <p
          style={{
            margin: "1.75rem 0 0",
            fontFamily: SERIF,
            fontSize: "clamp(0.72rem, 1.2vw, 0.88rem)",
            fontStyle: "italic",
            color: MUTED,
          }}
        >
          This certifies that
        </p>

        <p
          style={{
            margin: "0.5rem 0 0",
            fontFamily: SERIF,
            fontSize: "clamp(1.75rem, 4vw, 2.55rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: INK,
          }}
        >
          {displayName}
        </p>

        <div
          style={{
            marginTop: "0.65rem",
            width: "4rem",
            height: 1.5,
            background: TEAL,
          }}
        />

        <p
          style={{
            margin: "1.15rem 0 0",
            fontSize: "clamp(0.72rem, 1.22vw, 0.88rem)",
            lineHeight: 1.55,
            color: INK_SOFT,
            maxWidth: "32rem",
          }}
        >
          has successfully completed all required coursework and assessments for
        </p>

        <p
          style={{
            margin: "0.55rem 0 0",
            fontFamily: SERIF,
            fontSize: "clamp(1rem, 1.9vw, 1.28rem)",
            fontWeight: 700,
            lineHeight: 1.3,
            color: INK,
            maxWidth: "32rem",
          }}
        >
          {programName}
        </p>

        {/* Dual signature — professional, plain (no script flourishes) */}
        <div
          className="mt-auto flex w-full items-end justify-between gap-8"
          style={{
            paddingTop: "1.6rem",
            borderTop: "1px solid rgba(28,36,48,0.1)",
          }}
        >
          <div style={{ minWidth: "9rem" }}>
            <p
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: "clamp(0.88rem, 1.5vw, 1.05rem)",
                fontStyle: "italic",
                color: INK,
              }}
            >
              {COMPLETION_CERTIFICATE.signerName}
            </p>
            <div
              style={{
                marginTop: "0.35rem",
                width: "8.5rem",
                height: 1,
                background: INK,
                opacity: 0.35,
              }}
            />
            <p
              style={{
                margin: "0.35rem 0 0",
                fontSize: "clamp(0.62rem, 1.05vw, 0.76rem)",
                fontWeight: 700,
                color: INK,
              }}
            >
              {COMPLETION_CERTIFICATE.signerName}
            </p>
            <p
              style={{
                margin: "0.1rem 0 0",
                fontSize: "clamp(0.5rem, 0.88vw, 0.64rem)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              {COMPLETION_CERTIFICATE.signerTitle}
            </p>
          </div>

          <div style={{ textAlign: "right", minWidth: "9rem" }}>
            <p
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: "clamp(0.88rem, 1.5vw, 1.05rem)",
                fontStyle: "italic",
                color: INK,
              }}
            >
              {org}
            </p>
            <div
              style={{
                marginTop: "0.35rem",
                marginLeft: "auto",
                width: "8.5rem",
                height: 1,
                background: INK,
                opacity: 0.35,
              }}
            />
            <p
              style={{
                margin: "0.35rem 0 0",
                fontSize: "clamp(0.62rem, 1.05vw, 0.76rem)",
                fontWeight: 700,
                color: INK,
              }}
            >
              {org}
            </p>
            <p
              style={{
                margin: "0.1rem 0 0",
                fontSize: "clamp(0.5rem, 0.88vw, 0.64rem)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: MUTED,
              }}
            >
              Awarding Academy
            </p>
          </div>
        </div>

        {credentialId ? (
          <p
            style={{
              margin: "0.7rem 0 0",
              fontSize: "clamp(0.48rem, 0.85vw, 0.6rem)",
              letterSpacing: "0.1em",
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
