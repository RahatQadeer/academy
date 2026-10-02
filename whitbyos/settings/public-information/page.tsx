import { Callout } from "@/base/components/Callout";
import { Submit } from "@/base/components/Submit";
import { Toast } from "@/whitbyos/components/Toast";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { CONTROL, Field } from "@/whitbyos/settings/components/Fields";
import { saveOrganization } from "@/whitbyos/settings/actions";
import { getOrganizationProfile } from "@/whitbyos/lib/organization";
import { AREA, Section } from "@/whitbyos/settings/components/Section";

const PATH = "/whitbyos/settings/public-information";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Screen 17.1c — what a client may be shown, and what an engagement starts
 * from.
 *
 * Its own screen rather than a second half of Professional information: those
 * are the firm's own records — a registration number, a tax reference — and
 * these are the outward-facing ones, written for somebody else to read. The
 * two are edited on different days by different people.
 */
export default async function PublicInformationPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const organization = await getOrganizationProfile();
  const toast = one(searchParams?.toast);
  const error = one(searchParams?.error);

  if (!organization) {
    return (
      <SettingsShell active="public-information" title="Public & contract">
        <Callout tone="danger">No workspace found for this account.</Callout>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell active="public-information" title="Public & contract" width={640}>
      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <form action={saveOrganization} className="flex flex-col gap-7">
        {/* Which half of the organization profile this form is posting, so the
            action writes these fields and leaves the others alone. */}
        <input type="hidden" name="section" value="public" />

        <Section
          title="Public profile"
          note="What a prospective client can be shown. Nothing here is published on its own. It is what you quote from."
        >
          <div className="flex gap-4">
            <Field label="Public profile" htmlFor="public_profile_url" className="flex-1">
              <input
                id="public_profile_url"
                name="public_profile_url"
                defaultValue={organization.publicProfileUrl}
                placeholder="https://"
                className={CONTROL}
              />
            </Field>
            <Field label="Standing or ranking" htmlFor="ranking" className="flex-1">
              <input
                id="ranking"
                name="ranking"
                defaultValue={organization.ranking}
                placeholder="Where the practice is listed, and at what tier"
                className={CONTROL}
              />
            </Field>
          </div>

          <Field label="How the practice describes itself" htmlFor="public_summary">
            <textarea
              id="public_summary"
              name="public_summary"
              rows={3}
              defaultValue={organization.publicSummary}
              className={AREA}
            />
          </Field>

          <Field label="Accreditations and memberships" htmlFor="accreditations">
            <input
              id="accreditations"
              name="accreditations"
              defaultValue={organization.accreditations}
              className={CONTROL}
            />
          </Field>
        </Section>

        <Section
          title="Contract"
          note="The terms an engagement starts from, until you write different ones for a particular client."
        >
          <Field label="Standard contract terms" htmlFor="standard_contract_terms">
            <textarea
              id="standard_contract_terms"
              name="standard_contract_terms"
              rows={4}
              defaultValue={organization.standardContractTerms}
              placeholder="The terms every engagement letter starts from."
              className={AREA}
            />
          </Field>

          <Field label="Notice period" htmlFor="notice_period">
            <input
              id="notice_period"
              name="notice_period"
              defaultValue={organization.noticePeriod}
              placeholder="30 days, either side"
              className={CONTROL}
            />
          </Field>
        </Section>
        <div className="flex justify-end border-t border-line pt-5">
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Save changes
          </Submit>
        </div>
      </form>

      {toast ? <Toast title="Settings saved" detail={toast} closeHref={PATH} /> : null}
    </SettingsShell>
  );
}
