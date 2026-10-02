"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { createClient } from "@/base/lib/supabase/client";
import { TeamModal } from "@/partner-center/team/components/TeamModal";
import {
  confirmPartnerMfaEnrollment,
  preparePartnerMfaEnrollment,
} from "@/partner-center/settings/lib/mfa-actions";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

function friendlyEnrollError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("mfa") &&
    (lower.includes("disabled") ||
      lower.includes("not enabled") ||
      lower.includes("not been enabled") ||
      lower.includes("feature") ||
      lower.includes("unsupported"))
  ) {
    return "Two-factor authentication is not enabled on this project yet. Ask your platform admin to turn on MFA (TOTP) in Supabase Auth.";
  }
  return message;
}

export function MfaSetupModal({
  open,
  onClose,
  onEnabled,
}: {
  open: boolean;
  onClose: () => void;
  onEnabled?: () => void;
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setFactorId(null);
      setQr(null);
      setSecret(null);
      setCode("");

      try {
        const prepared = await preparePartnerMfaEnrollment();
        if (cancelled) return;
        if ("error" in prepared) {
          setError(prepared.error);
          return;
        }

        const supabase = createClient();
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Authenticator app",
        });

        if (cancelled) return;

        if (enrollError || !data) {
          setError(
            friendlyEnrollError(
              enrollError?.message ??
                "Could not start two-factor setup. Try again in a moment.",
            ),
          );
          return;
        }

        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch (caught) {
        if (!cancelled) {
          setError(
            friendlyEnrollError(
              caught instanceof Error
                ? caught.message
                : "Could not start two-factor setup.",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  function resetAndClose() {
    setFactorId(null);
    setQr(null);
    setSecret(null);
    setCode("");
    setError(null);
    onClose();
  }

  async function onConfirm() {
    if (!factorId) {
      setError("Setup was interrupted. Close and try again.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await runAction(
      () => confirmPartnerMfaEnrollment({ factorId, code }),
      { onValidationError: setError, onRetry: () => void onConfirm() },
    );
    setPending(false);
    if ("error" in result && result.error) return;
    onEnabled?.();
    router.refresh();
    resetAndClose();
  }

  return (
    <TeamModal
      title="Set up two-factor authentication"
      description="Scan with an authenticator app, then enter the six-digit code."
      onClose={resetAndClose}
      width={440}
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
            onClick={() => void onConfirm()}
            disabled={pending || loading || !factorId}
            unsized
            className="px-4 py-[9px] text-[13.5px]"
          >
            {pending ? "Turning on…" : "Turn on 2FA"}
          </Button>
        </>
      }
    >
      <div className="flex justify-center">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="Two-factor setup QR code"
            className="h-[180px] w-[180px]"
          />
        ) : (
          <div
            className="flex h-[180px] w-[180px] items-center justify-center rounded-[8px] border border-line text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {loading ? "Loading…" : "—"}
          </div>
        )}
      </div>

      {secret ? (
        <p
          className="mt-3 mb-0 text-center text-[12.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Can&apos;t scan? Enter this instead:{" "}
          <span className="font-mono" style={{ color: "var(--ink)" }}>
            {secret}
          </span>
        </p>
      ) : null}

      <label className="mt-4 block">
        <span
          className="mb-1.5 block text-[12.5px] font-medium uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Six-digit code
        </span>
        <input
          name="code"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void onConfirm();
            }
          }}
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          className="w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-center font-mono text-[16px] tracking-[0.3em]"
          style={{ color: "var(--ink)" }}
        />
      </label>

      {error ? (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      ) : null}
    </TeamModal>
  );
}
