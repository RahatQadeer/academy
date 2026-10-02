"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { ChangePasswordModal } from "@/partner-center/settings/components/ChangePasswordModal";
import { MfaSetupModal } from "@/partner-center/settings/components/MfaSetupModal";
import { disablePartnerMfa } from "@/partner-center/settings/lib/mfa-actions";
import {
  revokeOtherPartnerAuthSessions,
  revokePartnerAuthSession,
} from "@/partner-center/settings/lib/session-actions";
import type { PartnerMfaState } from "@/partner-center/settings/lib/security-state";
import type { PartnerAuthSession } from "@/partner-center/settings/lib/load-sessions";

function formatPasswordChanged(iso: string | null): string {
  if (!iso) return "Last changed —";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Last changed —";
  return `Last changed ${date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function SecuritySettingsView({
  passwordChangedAt,
  mfa,
  sessions,
}: {
  passwordChangedAt: string | null;
  mfa: PartnerMfaState;
  sessions: PartnerAuthSession[];
}) {
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const otherSessions = sessions.filter((session) => !session.isCurrent);
  const rows =
    sessions.length > 0
      ? sessions
      : [
          {
            id: "current",
            createdAt: "",
            updatedAt: null,
            refreshedAt: null,
            userAgent: null,
            ip: null,
            isCurrent: true,
            label: "This browser",
            detail: "Current session",
          } satisfies PartnerAuthSession,
        ];

  async function onDisableMfa() {
    if (!mfa.factorId) return;
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      const result = await disablePartnerMfa(mfa.factorId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStatus("Two-factor authentication is off.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not turn off 2FA.",
      );
    } finally {
      setPending(false);
    }
  }

  async function onRevokeSession(sessionId: string) {
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      const result = await revokePartnerAuthSession(sessionId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStatus("That session was signed out.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not sign out session.",
      );
    } finally {
      setPending(false);
    }
  }

  async function onRevokeOthers() {
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      const result = await revokeOtherPartnerAuthSessions();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStatus("Other sessions were signed out.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not sign out other sessions.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div
        className="mb-3.5 text-[13.5px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Password
      </div>
      <div className="mb-6 flex items-center justify-between rounded-[10px] border border-line bg-white px-[22px] py-5">
        <div>
          <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
            Password
          </div>
          <div
            className="mt-0.5 text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {formatPasswordChanged(passwordChangedAt)}
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setPasswordOpen(true)}
          unsized
          className="px-3.5 py-2 text-[13px]"
        >
          Change password
        </Button>
      </div>

      <div
        className="mb-3.5 text-[13.5px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Two-factor authentication
      </div>
      <div className="mb-3 flex items-center justify-between rounded-[10px] border border-line bg-white px-[22px] py-5">
        <div>
          <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
            Authenticator app
          </div>
          <div
            className="mt-0.5 text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Adds a code step when signing in
          </div>
        </div>
        {mfa.enabled ? (
          <span
            className="rounded px-2 py-0.5 text-[10.5px] font-medium"
            style={{ background: "#d6ecd8", color: "#1c7a52" }}
          >
            Enabled
          </span>
        ) : (
          <span
            className="rounded px-2 py-0.5 text-[10.5px] font-medium"
            style={{ background: "#efefed", color: "var(--text-secondary)" }}
          >
            Not set up
          </span>
        )}
      </div>
      <div className="mb-6 flex flex-wrap gap-2.5">
        {mfa.enabled ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMfaOpen(true)}
              disabled={pending}
              unsized
              className="px-3.5 py-2 text-[13px]"
            >
              Reconfigure
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onDisableMfa()}
              disabled={pending}
              unsized
              className="px-3.5 py-2 text-[13px]"
              style={{ color: "#a13d3d", borderColor: "#e8c4c4" }}
            >
              Turn off
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={() => setMfaOpen(true)}
            disabled={pending}
            unsized
            className="px-3.5 py-2 text-[13px]"
          >
            Set up
          </Button>
        )}
      </div>

      <div
        className="mb-3.5 text-[13.5px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Active sessions
      </div>
      <div className="mb-3 overflow-hidden rounded-[10px] border border-line bg-white">
        {rows.map((session, index) => {
          const last = index === rows.length - 1;
          return (
            <div
              key={session.id}
              className={`flex items-center justify-between px-[22px] py-4 ${
                last ? "" : "border-b border-line"
              }`}
            >
              <div>
                <div
                  className="text-[13.5px] font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  {session.label}
                </div>
                <div
                  className="mt-0.5 text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {session.detail}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {session.isCurrent ? (
                  <>
                    <span
                      className="rounded px-2 py-0.5 text-[10.5px] font-medium"
                      style={{ background: "#d6ecd8", color: "#1c7a52" }}
                    >
                      This device
                    </span>
                    <form action="/auth/sign-out" method="post">
                      <button
                        type="submit"
                        className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold"
                        style={{ color: "#a13d3d" }}
                      >
                        Sign out
                      </button>
                    </form>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void onRevokeSession(session.id)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold disabled:opacity-50"
                    style={{ color: "#a13d3d" }}
                  >
                    Sign out
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {otherSessions.length > 0 ? (
        <div className="mb-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onRevokeOthers()}
            disabled={pending}
            unsized
            className="px-3.5 py-2 text-[13px]"
          >
            Sign out of other sessions
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}
      {status ? (
        <p
          className="mt-4 mb-0 text-[13.5px]"
          style={{ color: "var(--text-secondary)" }}
          role="status"
        >
          {status}
        </p>
      ) : null}

      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        passwordChangedAt={passwordChangedAt}
        mfaEnabled={mfa.enabled}
      />
      <MfaSetupModal
        open={mfaOpen}
        onClose={() => setMfaOpen(false)}
        onEnabled={() =>
          setStatus(
            "Two-factor authentication is on. You will be asked for a code next time you sign in.",
          )
        }
      />
    </>
  );
}
