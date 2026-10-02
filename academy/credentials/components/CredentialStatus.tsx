import type { AcademyCredentialStatus } from "@/academy/lib/domain";
import { credentialStatusTone } from "../utils/labels";
import { credentialStatusChip } from "../utils/presentation";

export function CredentialStatus({ status }: { status: AcademyCredentialStatus }) {
  const tone = credentialStatusTone(status);
  const colors =
    tone === "success"
      ? { background: "var(--success-bg)", color: "var(--success-fg)" }
      : tone === "warning"
        ? { background: "var(--warning-bg)", color: "var(--warning-fg)" }
        : { background: "var(--info-bg)", color: "var(--info-fg)" };

  return (
    <span
      className="inline-flex rounded-[4px] px-2 py-[2px] text-[10.5px] font-medium"
      style={colors}
    >
      {credentialStatusChip(status)}
    </span>
  );
}
