import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Modal } from "@/whitbyos/components/Modal";
import { Toast } from "@/whitbyos/components/Toast";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { DetailRow } from "@/whitbyos/settings/components/Fields";
import { EnrolPanel } from "@/whitbyos/settings/security/components/EnrolPanel";
import {
  disableTwoFactor,
  saveSessionLimit,
  signOutOtherSessions,
} from "@/whitbyos/settings/security/actions";
import { getSecurityState } from "@/whitbyos/lib/security";
import { SessionTimeoutField } from "@/whitbyos/settings/security/components/SessionTimeoutField";

const SECURITY = "/whitbyos/settings/security";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screen 17.6 — Security. */
export default async function SecuritySettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const state = await getSecurityState();

  const setupId = one(searchParams?.setup);
  const toast = one(searchParams?.toast);
  const error = one(searchParams?.error);

  return (
    <SettingsShell active="security" title="Sign-in" width={680}>
      {error && !setupId ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <h2 className="mb-2.5 text-[14px] font-semibold">Session Timeout</h2>
      <p className="mb-3 max-w-[40rem] text-[12.5px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
        If you step away and leave Whitby open, we sign this device out after
        the time you pick. A laptop left on a desk does not stay signed in.
        Work you already saved is kept.
      </p>
      <div className="rounded-[8px] border border-line px-5 py-4">
        <SessionTimeoutField />
      </div>

      <h2 className="mb-2.5 mt-8 text-[14px] font-semibold">One session at a time</h2>
      <form action={saveSessionLimit} className="rounded-[8px] border border-line px-5 py-4">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            name="single_session"
            defaultChecked={state.singleSession}
            className="mt-0.5 h-[15px] w-[15px] shrink-0"
            style={{ accentColor: "var(--accent)" }}
          />
          <span>
            <span className="block text-[13.5px]">
              Limit to one active session at a time
            </span>
            <span className="mt-1 block text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
              Signing in on a new device signs out all others. Separate from 2FA,
              this stops one login being shared instead of buying a seat.
            </span>
            <span className="mt-1.5 block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              Recorded, not yet enforced: refusing the second sign-in is the auth
              service&apos;s job, and that is a project setting rather than
              something this screen can switch.
            </span>
          </span>
        </label>

        <div className="mt-3 flex justify-end">
          <Submit unsized variant="primary" className="px-4 py-[9px] text-[13.5px]">
            Save
          </Submit>
        </div>
      </form>

      <h2 className="mb-2.5 mt-8 text-[14px] font-semibold">Active sessions</h2>

      <div className="rounded-[8px] border border-line px-5 py-4">
        <div className="flex items-center justify-between gap-4 pb-3.5">
          <span className="text-[13.5px]">
            This device
            <span className="block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              Current session · Active now
            </span>
          </span>
          <Link
            href="/auth/sign-out"
            className="shrink-0 rounded-control border border-line-strong px-3 py-1.5 text-[12.5px] font-medium no-underline"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
          >
            Log out
          </Link>
        </div>

        <div className="border-t border-line pt-3.5">
          <p className="mb-2.5 text-[12.5px] leading-[1.6]" style={{ color: "var(--text-tertiary)" }}>
            Other devices are not listed: the app is not told which sessions
            exist, only how to end them.
          </p>
          <form action={signOutOtherSessions}>
            <SubmitPlain
              className="rounded-control border border-line-strong px-3.5 py-[7px] text-[13px] font-medium"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              Log out of all other sessions
            </SubmitPlain>
          </form>
        </div>
      </div>

      <h2 className="mb-2.5 mt-8 text-[14px] font-semibold">Two-factor authentication</h2>

      <div className="overflow-hidden rounded-[8px] border border-line">
        <DetailRow label="Status">
          {state.enabled ? (
            <Pill tone="success">Enabled</Pill>
          ) : (
            <Pill tone="neutral">Not set up</Pill>
          )}
        </DetailRow>

        <DetailRow label="Method" last={!state.enabled}>
          <span
            className="text-[13.5px]"
            style={{ color: state.enabled ? "var(--ink)" : "var(--text-disabled)" }}
          >
            {state.method ?? "None"}
          </span>
        </DetailRow>

        {state.enabled ? (
          <DetailRow label="Required workspace-wide" last>
            <span className="text-[13.5px]" style={{ color: "var(--text-disabled)" }}>
              Off, each person turns it on for themselves
            </span>
          </DetailRow>
        ) : null}
      </div>

      <div className="mt-4 flex gap-2.5">
        {state.enabled ? (
          <>
            <Link
              href={`${SECURITY}?setup=1`}
              className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              Reconfigure authenticator app
            </Link>

            <form action={disableTwoFactor}>
              <input type="hidden" name="factor_id" value={state.factorId ?? ""} />
              <SubmitPlain
                className="rounded-control border px-4 py-[9px] text-[13.5px] font-medium"
                style={{
                  borderColor: "var(--danger-border)",
                  color: "var(--danger-outline-fg)",
                  background: "var(--surface)",
                }}
              >
                Turn off 2FA
              </SubmitPlain>
            </form>
          </>
        ) : (
          <Button
            unsized
            href={`${SECURITY}?setup=1`}
            variant="primary"
            className="px-4 py-[9px] text-[13.5px]"
          >
            Set up 2FA
          </Button>
        )}
      </div>

      <p className="mt-3 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        There are no backup codes. If you lose your authenticator, an Owner or
        Admin has to turn 2FA off for you before you can sign in again.
      </p>

      {setupId ? (
        <Modal title="Set up two-factor authentication" closeHref={SECURITY} width={440} dense>
          <EnrolPanel error={error} />
        </Modal>
      ) : null}

      {toast ? <Toast title="Sign-in" detail={toast} closeHref={SECURITY} /> : null}
    </SettingsShell>
  );
}
