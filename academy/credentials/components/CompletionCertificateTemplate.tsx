import { cn } from "@/base/lib/cn";
import { CertificateFrame } from "./CertificateFrame";
import { CertificateSignature } from "./CertificateSignature";
import { COMPLETION_CERTIFICATE } from "../lib/certificateConfig";
import { formatCertificateName } from "../utils/presentation";

const INK = "#0e2b5b";
const SCRIPT =
  '"Segoe Script", "Snell Roundhand", "Brush Script MT", "Apple Chancery", "Lucida Handwriting", cursive';
const SANS = 'Arial, "Helvetica Neue", Helvetica, ui-sans-serif, system-ui, sans-serif';

export type CompletionCertificateProps = {
  learnerName: string;
  programName: string;
  issuedOn: string;
  credentialId?: string;
  variant?: "completion" | "credential";
  credentialTitle?: string;
  className?: string;
};

export function CompletionCertificateTemplate({
  learnerName,
  programName,
  issuedOn,
  credentialId,
  variant = "completion",
  credentialTitle,
  className,
}: CompletionCertificateProps) {
  const title =
    variant === "credential" ? "CERTIFICATE OF CREDENTIAL" : "CERTIFICATE OF COMPLETION";
  const displayName = formatCertificateName(learnerName);

  return (
    <div
      className={cn("certificate-sheet relative mx-auto select-none overflow-hidden", className)}
      style={{
        aspectRatio: "1024 / 729",
        boxShadow: "0 2px 0 rgba(14,43,91,0.05), 0 12px 36px rgba(14,43,91,0.12)",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <CertificateFrame />

      <div
        className="absolute z-[1] flex flex-col"
        style={{
          top: "11%",
          bottom: "10%",
          left: "7.5%",
          right: "24%",
          color: INK,
          fontFamily: SANS,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "clamp(1.05rem, 2.4vw, 1.55rem)",
            fontWeight: 800,
            letterSpacing: "0.08em",
            lineHeight: 1.15,
          }}
        >
          {title}
        </p>
        <p
          style={{
            margin: "0.85rem 0 0",
            fontSize: "clamp(0.72rem, 1.25vw, 0.88rem)",
            letterSpacing: "0.04em",
          }}
        >
          This is to certify that
        </p>

        <p
          style={{
            margin: "0.55rem 0 0",
            fontFamily: SCRIPT,
            fontSize: "clamp(1.85rem, 4.6vw, 2.85rem)",
            lineHeight: 1.1,
          }}
        >
          {displayName}
        </p>
        <div
          style={{
            marginTop: "0.35rem",
            height: 1,
            width: "min(100%, 28rem)",
            background: INK,
          }}
        />

        <p
          style={{
            margin: "1.1rem 0 0",
            fontSize: "clamp(0.78rem, 1.35vw, 0.95rem)",
            lineHeight: 1.65,
            maxWidth: "36rem",
          }}
        >
          {variant === "credential" ? (
            <>
              has been awarded the credential of{" "}
              <strong>&ldquo;{credentialTitle ?? programName}&rdquo;</strong> conferred by{" "}
              <strong>{COMPLETION_CERTIFICATE.organizationName}</strong>.
            </>
          ) : (
            <>
              has successfully completed the course{" "}
              <strong>&ldquo;{programName}&rdquo;</strong> conducted by{" "}
              <strong>{COMPLETION_CERTIFICATE.organizationName}</strong>.
            </>
          )}
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-6 pt-6">
          <div style={{ minWidth: 160, maxWidth: 220 }}>
            <CertificateSignature />
            <p
              style={{
                margin: "0.4rem 0 0",
                fontSize: "clamp(0.72rem, 1.2vw, 0.86rem)",
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {COMPLETION_CERTIFICATE.signerName}
            </p>
            <p
              style={{
                margin: "0.12rem 0 0",
                fontSize: "clamp(0.66rem, 1.1vw, 0.8rem)",
              }}
            >
              {COMPLETION_CERTIFICATE.signerTitle}
            </p>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "clamp(0.68rem, 1.15vw, 0.82rem)",
              whiteSpace: "nowrap",
            }}
          >
            Issued on {issuedOn}
          </p>
        </div>
      </div>

      {credentialId ? (
        <p
          className="absolute z-[1]"
          style={{
            left: "7.5%",
            bottom: "4.2%",
            margin: 0,
            fontSize: "clamp(0.52rem, 0.9vw, 0.64rem)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(14,43,91,0.55)",
            fontFamily: SANS,
          }}
        >
          Certificate ID · {credentialId}
        </p>
      ) : null}
    </div>
  );
}
