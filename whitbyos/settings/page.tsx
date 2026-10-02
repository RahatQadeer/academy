import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Toast } from "@/whitbyos/components/Toast";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { LogoField } from "@/whitbyos/settings/components/LogoField";
import { OrganizationUrlField } from "@/whitbyos/settings/components/OrganizationUrlField";
import { CONTROL, Field, LABEL } from "@/whitbyos/settings/components/Fields";
import { saveWorkspace } from "@/whitbyos/settings/actions";
import { getWorkspaceSettings } from "@/whitbyos/lib/settings";
import { Section } from "@/whitbyos/settings/components/Section";

const PATH = "/whitbyos/settings";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Screen 17.1 — the organization, and what Settings opens on.
 *
 * "Workspace" was a tab three places down a rail that opened on one person's
 * profile. This is the firm — its name, its mark, where it lives on the web,
 * the time and money it counts in — so it leads.
 */
export default async function OrganizationSettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const workspace = await getWorkspaceSettings();
  const toast = one(searchParams?.toast);
  const error = one(searchParams?.error);

  if (!workspace) {
    return (
      <SettingsShell active="workspace" title="Organization">
        <Callout tone="danger">No workspace found for this account.</Callout>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell active="workspace" title="Organization">
      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <Section
        title="Identity"
        note="The name and mark the rest of Whitby uses for this firm."
      >
        {/* Outside the form below: choosing a file uploads it there and then,
            so it must not be swept up by that form's Save. */}
        <div>
          <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
            Organization logo
          </span>
          <div className="mt-2">
            <LogoField name={workspace.name} logoUrl={workspace.logoUrl} />
          </div>
        </div>

        <form action={saveWorkspace} className="flex flex-col gap-4">
          <Field label="Organization name" htmlFor="name">
            <input id="name" name="name" defaultValue={workspace.name} className={CONTROL} />
          </Field>

          <OrganizationUrlField defaultSlug={workspace.urlSlug} showCopy size="settings" />

          <div className="mt-3 flex justify-end">
            <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
              Save changes
            </Submit>
          </div>
        </form>
      </Section>

      {toast ? <Toast title="Settings saved" detail={toast} closeHref={PATH} /> : null}
    </SettingsShell>
  );
}
