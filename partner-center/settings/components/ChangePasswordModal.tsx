"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { TeamModal } from "@/partner-center/team/components/TeamModal";
import { changePartnerPassword } from "@/partner-center/settings/lib/actions";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

function formatPasswordChanged(iso: string | null): string {
  if (!iso) return "Last changed —";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Last changed —";
  return `Last changed ${date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}.`;
}

export function ChangePasswordModal({
  open,
  onClose,
  passwordChangedAt,
  mfaEnabled = false,
}: {
  open: boolean;
  onClose: () => void;
  passwordChangedAt: string | null;
  mfaEnabled?: boolean;
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  function resetAndClose() {
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    setMfaCode("");
    setError(null);
    onClose();
  }

  async function onSave() {
    setPending(true);
    setError(null);
    const result = await runAction(
      () =>
        changePartnerPassword({
          currentPassword,
          password,
          confirmPassword,
          mfaCode: mfaEnabled ? mfaCode : undefined,
        }),
      { onValidationError: setError, onRetry: () => void onSave() },
    );
    setPending(false);
    if ("error" in result && result.error) return;
    router.refresh();
    resetAndClose();
  }

  return (
    <TeamModal
      title="Change password"
      description={
        mfaEnabled
          ? `${formatPasswordChanged(passwordChangedAt)} Because two-factor authentication is on, enter a code from your authenticator app as well.`
          : formatPasswordChanged(passwordChangedAt)
      }
      onClose={resetAndClose}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={resetAndClose}
            disabled={pending}
            unsized
            className="px-4 py-[9px] text-[13.5px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void onSave()}
            disabled={pending}
            unsized
            className="px-4 py-[9px] text-[13.5px]"
          >
            {pending ? "Updating…" : "Update password"}
          </Button>
        </>
      }
    >
      <Input
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        required
      />
      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        minLength={8}
        required
      />
      <Input
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        placeholder="Re-enter new password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        minLength={8}
        required
      />
      {mfaEnabled ? (
        <Input
          label="Authenticator code"
          name="mfaCode"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          value={mfaCode}
          onChange={(event) =>
            setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          maxLength={6}
          required
        />
      ) : null}
      {error ? <FormError message={error} /> : null}
    </TeamModal>
  );
}
