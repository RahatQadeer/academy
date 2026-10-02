import { SubmitPlain } from "@/base/components/Submit";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import Link from "next/link";
import {
  deleteAccount,
  requestDataExport,
  savePrivacy,
} from "@/client-portal/lib/actions/settings";
import { Modal } from "@/client-portal/components/Modal";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { Row, RowList, RowMeta } from "@/client-portal/components/Surface";
import { FormActions } from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { SettingsShell } from "../components/SettingsShell";

const OPTIONS = [
  {
    name: "hideFromMembers",
    label: "Keep my requests private from other members",
    help: "Sharing an account never gives another member access to your own requests, this keeps it that way by default.",
    defaultChecked: true,
  },
  {
    name: "shareActivity",
    label: "Let my team see when I've viewed shared items",
    help: "Helps your team know a document reached you without needing to ask.",
    defaultChecked: true,
  },
  {
    name: "assistantVisibility",
    label: "Allow my authorized users to see my calendar items",
    help: "Applies only to people already permitted to act for you.",
    defaultChecked: false,
  },
];

const PRIVACY = "/client-portal/settings/privacy";

export default async function PrivacySettingsScreen({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const context = await getPortalContext();

  const raw = searchParams?.delete;
  const confirming = (Array.isArray(raw) ? raw[0] : raw) === "1";

  return (
    <SettingsShell
      active="privacy"
      title="Privacy"
      description="Being part of the same account never automatically shares your requests, messages, or documents with another member."
    >
      <DataNotice context={context} />
      <form action={savePrivacy}>
        <RowList>
          {OPTIONS.map((option) => (
            <Row key={option.name} className="items-start">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={option.name}
                  className="cursor-pointer text-[14px] font-medium"
                >
                  {option.label}
                </label>
                <RowMeta>{option.help}</RowMeta>
              </div>
              <input
                id={option.name}
                type="checkbox"
                name={option.name}
                defaultChecked={option.defaultChecked}
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
            </Row>
          ))}
        </RowList>

        <FormActions>
          <SubmitButton pendingLabel="Saving…">Save privacy settings</SubmitButton>
        </FormActions>
      </form>

      <div className="mt-6">
        <RowList>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">Download my data</div>
              <RowMeta>
                Export a copy of your requests, documents, and messages.
              </RowMeta>
            </div>
            <form action={requestDataExport}>
              <SubmitButton pendingLabel="Requesting…" variant="secondary">
                Request export
              </SubmitButton>
            </form>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium" style={{ color: "var(--danger-fg)" }}>
                Delete account
              </div>
              <RowMeta>
                Permanently remove your access and personal data.
              </RowMeta>
            </div>
            {/* A link rather than a submit: this cannot be undone, so it opens
                the confirmation instead of doing it. */}
            <Link
              href={`${PRIVACY}?delete=1`}
              className="rounded-control border px-3 py-1.5 text-[13.5px] font-medium no-underline"
              style={{
                color: "var(--danger-fg)",
                borderColor: "var(--danger-border)",
                background: "var(--danger-bg)",
              }}
            >
              Delete account
            </Link>
          </Row>
        </RowList>
      </div>
      {confirming ? (
        <Modal
          title="Delete your account"
          description="This cannot be undone."
          closeHref={PRIVACY}
          width={460}
        >
          <div className="mb-5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <p className="mb-3">
              Your sign-in is deleted and you lose access to this portal
              immediately. You will not be able to sign in again.
            </p>
            <p>
              Your requests, documents and messages stay with{" "}
              <strong style={{ color: "var(--ink)" }}>{context.accountName}</strong>
              {". "}They are that team&apos;s record of the work done for you. To
              have those erased as well, ask them directly.
            </p>
          </div>

          <form action={deleteAccount} className="flex flex-col gap-4">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium">
                Type DELETE to confirm
              </span>
              <input
                name="confirm"
                required
                autoComplete="off"
                placeholder="DELETE"
                className="w-full rounded-control border border-line-strong bg-surface px-3 py-2.5 text-[14px]"
              />
            </label>

            <div className="flex justify-end gap-2.5">
              <Link
                href={PRIVACY}
                className="rounded-control border border-line-strong px-4 py-2 text-[13.5px] font-medium no-underline"
                style={{ color: "var(--ink)" }}
              >
                Keep my account
              </Link>
              <SubmitPlain
                className="rounded-control px-4 py-2 text-[13.5px] font-medium text-white"
                style={{ background: "var(--danger-fg)" }}
              >
                Delete my account
              </SubmitPlain>
            </div>
          </form>
        </Modal>
      ) : null}
    </SettingsShell>
  );
}
