import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { Toast } from "@/whitbyos/components/Toast";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { PhotoField } from "@/whitbyos/settings/components/PhotoField";
import { Section } from "@/whitbyos/settings/components/Section";
import { getSettingsProfile } from "@/whitbyos/lib/settings";
import { changeOwnPassword, deleteOwnAccount, saveProfile } from "@/whitbyos/settings/actions";

const SETTINGS = "/whitbyos/settings/profile";

const LABEL = "mb-1.5 block text-[12.5px] font-medium";
const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-[13.5px] text-ink";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Screen 17 — your own account, which is not the organization's.
 *
 * It used to be what Settings opened on, so pressing Settings under a firm's
 * name showed one person's photograph and password. The firm opens the area
 * now and this sits at the end of the rail, behind a rule, where a personal
 * thing belongs among organization ones.
 *
 * The Danger zone at the bottom has no counterpart in the export, which draws
 * no way to close an account anywhere in Settings. It is here because a person
 * must be able to leave, and because what leaving costs depends entirely on who
 * else is in the workspace — so the screen works that out and says it before
 * anyone presses anything.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const profile = await getSettingsProfile();

  const toast = one(searchParams?.toast);
  const error = one(searchParams?.error);
  const changing = one(searchParams?.password) === "1";
  const closing = one(searchParams?.close) === "1";

  if (!profile) {
    return (
      <SettingsShell active="profile" title="Profile">
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your profile. Check your connection and try again, if this keeps happening, contact support."
          action={
            <Button unsized href={SETTINGS} variant="primary" className="px-[18px] py-[9px]">
              Try again
            </Button>
          }
        />
      </SettingsShell>
    );
  }

  const alone = profile.teammateCount === 0;

  return (
    <SettingsShell active="profile" title="Profile">
      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <Section title="Your account" note="The name and photograph people see beside your work, and the password you sign in with.">
        <PhotoField
          initials={profile.initials}
          avatarUrl={profile.avatarUrl}
          name={profile.fullName || profile.email}
          roleLabel={profile.roleLabel}
          email={profile.email}
        />

        <form action={saveProfile} className="flex flex-col gap-4">
          <div>
            <label htmlFor="full_name" className={LABEL} style={{ color: "var(--text-secondary)" }}>
              Full name
            </label>
            <input id="full_name" name="full_name" defaultValue={profile.fullName} className={CONTROL} />
          </div>

          <div>
            <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
              Password
            </span>
            <Link
              href={`${SETTINGS}?password=1`}
              className="inline-block rounded-control border border-line-strong px-3.5 py-2 text-[13px] font-medium no-underline"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              Change password
            </Link>
          </div>

          <div className="mt-3 flex justify-end">
            <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
              Save changes
            </Submit>
          </div>
        </form>
      </Section>

      {/* Not in the export. */}
      <Section
        title="Delete my account"
        note={`Your sign-in is revoked and you lose access immediately. ${profile.workspaceName} and everything in it stays. Its clients, requests, documents and billing history belong to the firm, not to one login.`}
      >
        <div>
          <Link
            href={`${SETTINGS}?close=1`}
            className="inline-block rounded-control border px-3.5 py-2 text-[13px] font-medium no-underline"
            style={{
              color: "var(--danger-outline-fg)",
              borderColor: "var(--danger-border)",
              background: "var(--danger-bg, #ffe2dd)",
            }}
          >
            Delete my account…
          </Link>
        </div>
      </Section>

      {changing ? (
        <Modal title="Change password" closeHref={SETTINGS} width={460} dense>
          {/*
           * Three fields, and the first one is the point.
           *
           * It asked for a new password twice and never for the old one, so
           * anybody holding an open session could change it — a borrowed
           * laptop, a window left open in an office. The current password is
           * what makes this the account holder's act rather than the
           * session's.
           */}
          <form action={changeOwnPassword} className="flex flex-col gap-4">
            <p
              className="text-[12.5px] leading-[1.55]"
              style={{ color: "var(--text-tertiary)", margin: 0 }}
            >
              You stay signed in here. Anywhere else you are signed in keeps
              its session until it expires.
            </p>

            <div>
              <label
                htmlFor="current_password"
                className={LABEL}
                style={{ color: "var(--text-secondary)" }}
              >
                Current password
              </label>
              <input
                id="current_password"
                name="current_password"
                type="password"
                required
                autoComplete="current-password"
                className={CONTROL}
              />
            </div>

            <div className="border-t border-line pt-4">
              <label htmlFor="password" className={LABEL} style={{ color: "var(--text-secondary)" }}>
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={CONTROL}
              />
              <p
                className="mt-1.5 text-[11.5px]"
                style={{ color: "var(--text-tertiary)", margin: "6px 0 0" }}
              >
                At least 8 characters, and not the one you are replacing.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirm_password"
                className={LABEL}
                style={{ color: "var(--text-secondary)" }}
              >
                Confirm new password
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className={CONTROL}
              />
            </div>

            <div className="mt-1 flex justify-end gap-2.5 border-t border-line pt-4">
              <Button unsized href={SETTINGS} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
                Cancel
              </Button>
              <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
                Change password
              </Submit>
            </div>
          </form>
        </Modal>
      ) : null}

      {closing ? (
        <Modal title="Delete your account" closeHref={SETTINGS} width={470} dense>
          <div className="mb-5 text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
            <p className="mb-3">
              This cannot be undone. Your sign-in is revoked and you will not be
              able to get back in.
            </p>

            {alone ? (
              // The one case the code will not decide on its own.
              <div className="mb-3">
                <Callout tone="warning">
                  You are the only person in {profile.workspaceName}
                  {profile.clientCount > 0 || profile.openRequestCount > 0 ? (
                    <>
                      , and it still holds {profile.clientCount}{" "}
                      {profile.clientCount === 1 ? "client" : "clients"} and{" "}
                      {profile.openRequestCount} open{" "}
                      {profile.openRequestCount === 1 ? "request" : "requests"}
                    </>
                  ) : null}
                  . Nothing will be deleted, but nobody will be able to reach it
                  either, it will be flagged for review so someone can decide
                  what happens to that work.
                </Callout>
              </div>
            ) : (
              <p className="mb-3">
                {profile.workspaceName} keeps running for the{" "}
                {profile.teammateCount === 1
                  ? "one other person"
                  : `${profile.teammateCount} other people`}{" "}
                in it, and ownership passes to a colleague. Your clients keep
                their portal access.
              </p>
            )}

            <p className="mb-3">
              Requests, work plans, documents, messages and billing history all
              stay. They are the firm&apos;s record of work done for real people.
            </p>

            <p>
              Your name stays on the work you did, the client you added, the
              request you closed. That attribution is part of the record and
              cannot be unpicked from it.
            </p>
          </div>

          <form action={deleteOwnAccount} className="flex flex-col gap-4">
            <div>
              <label htmlFor="confirm" className={LABEL} style={{ color: "var(--text-secondary)" }}>
                Type DELETE to confirm
              </label>
              <input
                id="confirm"
                name="confirm"
                required
                autoComplete="off"
                placeholder="DELETE"
                className={CONTROL}
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <Button unsized href={SETTINGS} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
                Keep my account
              </Button>
              <SubmitPlain
               
                className="rounded-control px-[18px] py-[9px] text-[13.5px] font-medium text-white"
                style={{ background: "var(--danger-solid, #b3261e)" }}
              >
                Close my account
              </SubmitPlain>
            </div>
          </form>
        </Modal>
      ) : null}

      {toast ? (
        <Toast title="Settings saved" detail={toast} closeHref={SETTINGS} />
      ) : null}
    </SettingsShell>
  );
}
