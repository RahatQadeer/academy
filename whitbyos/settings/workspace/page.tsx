import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Toast } from "@/whitbyos/components/Toast";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { ClassificationField } from "@/whitbyos/settings/components/ClassificationField";
import { CONTROL, Field } from "@/whitbyos/settings/components/Fields";
import { saveWorkspace } from "@/whitbyos/settings/actions";
import { getWorkspaceSettings } from "@/whitbyos/lib/settings";
import { CURRENCIES, TIMEZONES } from "@/whitbyos/lib/settings-vocab";
import { PortalSwitch } from "@/whitbyos/settings/components/PortalSwitch";
import { ClientWorkspaceExplain } from "@/whitbyos/components/ClientWorkspaceExplain";
import { PortalUpgradePrompt } from "@/whitbyos/components/PortalUpgradePrompt";
import { planIncludesClientPortal } from "@/whitbyos/lib/billing-vocab";
import { getCurrentWorkspacePlan } from "@/whitbyos/lib/workspace";
import { Section } from "@/whitbyos/settings/components/Section";

const PATH = "/whitbyos/settings/workspace";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Screen 17.1a — how the workspace counts, and whether it uses Client Workspaces.
 */
export default async function WorkspaceSettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const workspace = await getWorkspaceSettings();
  const portalOpen = workspace?.portalEnabled !== false;
  const usesClients = workspace?.usesClientWorkspaces !== false;
  const portalOnPlan = planIncludesClientPortal(await getCurrentWorkspacePlan());
  const toast = one(searchParams?.toast);
  const error = one(searchParams?.error);

  if (!workspace) {
    return (
      <SettingsShell active="workspace-defaults" title="General">
        <Callout tone="danger">No workspace found for this account.</Callout>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell active="workspace-defaults" title="General">
      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <form action={saveWorkspace} className="flex flex-col gap-1">
        <Section
          title="Workspaces"
          note="Whether this organization keeps a separate workspace for each client, or one workspace for the firm."
        >
          <ClientWorkspaceExplain compact />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <ModeOption
              value="yes"
              title="Workspace: Yes"
              body="A separate workspace per client relationship."
              defaultChecked={usesClients}
            />
            <ModeOption
              value="no"
              title="Workspace: No"
              body="One organization workspace. Client nav and restrictions stay hidden."
              defaultChecked={!usesClients}
            />
          </div>
        </Section>

        <Section
          title="Time and money"
          note="Defaults this workspace uses for clocks, calendars and figures."
        >
          <div className="flex gap-4">
            <Field label="Default time zone" htmlFor="timezone" className="flex-1">
              <select
                id="timezone"
                name="timezone"
                defaultValue={workspace.timezone}
                className={CONTROL}
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Default currency" htmlFor="currency" className="flex-1">
              <select
                id="currency"
                name="currency"
                defaultValue={workspace.currency}
                className={CONTROL}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {usesClients ? (
          <>
            <input type="hidden" name="client_fields" value="1" />
            <Section
              title="Client records"
              note="The classifications you can give a client when you set one up."
            >
              <ClassificationField initial={workspace.classifications} />
            </Section>

            <Section
              title="Client Portal"
              note="Whether invited clients can sign in. This follows the plan you are on."
            >
              {portalOnPlan ? (
                <label
                  className="flex items-start justify-between gap-4 rounded-[10px] border px-4 py-3.5"
                  style={{ borderColor: "var(--chrome-line)", background: "var(--surface-soft)" }}
                >
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium">
                      {portalOpen ? "The portal is open" : "The portal is closed"}
                    </span>
                    <span
                      className="mt-1 block text-[12.5px] leading-[1.55]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {portalOpen
                        ? "Clients with an invitation can sign in and use the areas they have been given."
                        : "Nobody can sign in to it, and anyone already signed in is signed out. Their accounts, documents and history are untouched."}
                    </span>
                  </span>

                  <PortalSwitch defaultOn={portalOpen} />
                </label>
              ) : (
                <PortalUpgradePrompt />
              )}
            </Section>
          </>
        ) : null}

        <div className="mt-5 flex justify-end">
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Save changes
          </Submit>
        </div>
      </form>

      {toast ? <Toast title="Settings saved" detail={toast} closeHref={PATH} /> : null}
    </SettingsShell>
  );
}

function ModeOption({
  value,
  title,
  body,
  defaultChecked,
}: {
  value: "yes" | "no";
  title: string;
  body: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      className="cursor-pointer rounded-[10px] border px-4 py-3.5 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-tint)]"
      style={{ borderColor: "var(--chrome-line)", background: "var(--surface)" }}
    >
      <input
        type="radio"
        name="uses_client_workspaces"
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      <span className="block text-[13.5px] font-semibold">{title}</span>
      <span className="mt-1 block text-[12.5px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
        {body}
      </span>
    </label>
  );
}
