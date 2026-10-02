import { Callout } from "@/base/components/Callout";
import { Submit } from "@/base/components/Submit";
import { Toast } from "@/whitbyos/components/Toast";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { CONTROL, Field } from "@/whitbyos/settings/components/Fields";
import { saveOrganization } from "@/whitbyos/settings/actions";
import { getOrganizationProfile, RATE_UNITS } from "@/whitbyos/lib/organization";
import { AREA, Section } from "@/whitbyos/settings/components/Section";

const PATH = "/whitbyos/settings/organization";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Screen 17.1b — the organization's own profile.
 *
 * Whitby held a great deal about every client and almost nothing about the
 * firm. This is the firm: who it is professionally, what of that a client may
 * see, what an engagement starts from, and what its time costs internally.
 *
 * One form for all three, because they are saved together or not at all.
 */
export default async function OrganizationSettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const organization = await getOrganizationProfile();
  const toast = one(searchParams?.toast);
  const error = one(searchParams?.error);

  if (!organization) {
    return (
      <SettingsShell active="organization" title="Professional information">
        <Callout tone="danger">No workspace found for this account.</Callout>
      </SettingsShell>
    );
  }

  const rate =
    organization.internalRateCents === null
      ? ""
      : String(organization.internalRateCents / 100);

  return (
    <SettingsShell active="organization" title="Professional information" width={640}>
      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <form action={saveOrganization} className="flex flex-col gap-7">
        {/* Which half of the organization profile this form is posting, so the
            action writes these fields and leaves the others alone. */}
        <input type="hidden" name="section" value="professional" />

        <Section
          title="Professional information"
          note={`The details that identify ${organization.name} as a practice: on an engagement letter, an invoice, or a client's own records.`}
        >
          <div className="flex gap-4">
            <Field label="Registered name" htmlFor="legal_name" className="flex-1">
              <input
                id="legal_name"
                name="legal_name"
                defaultValue={organization.legalName}
                placeholder={organization.name}
                className={CONTROL}
              />
            </Field>
            <Field label="Practice type" htmlFor="practice_type" className="flex-1">
              <input
                id="practice_type"
                name="practice_type"
                defaultValue={organization.practiceType}
                placeholder="Family office, private practice, advisory firm"
                className={CONTROL}
              />
            </Field>
          </div>

          <div className="flex gap-4">
            <Field label="Registration number" htmlFor="registration_number" className="flex-1">
              <input
                id="registration_number"
                name="registration_number"
                defaultValue={organization.registrationNumber}
                className={CONTROL}
              />
            </Field>
            <Field label="Tax reference" htmlFor="tax_id" className="flex-1">
              <input id="tax_id" name="tax_id" defaultValue={organization.taxId} className={CONTROL} />
            </Field>
            <Field label="Founded" htmlFor="founded_year" className="w-[110px] shrink-0">
              <input
                id="founded_year"
                name="founded_year"
                inputMode="numeric"
                defaultValue={organization.foundedYear}
                placeholder="2016"
                className={CONTROL}
              />
            </Field>
          </div>

          <div className="flex gap-4">
            <Field label="Professional email" htmlFor="professional_email" className="flex-1">
              <input
                id="professional_email"
                name="professional_email"
                type="email"
                defaultValue={organization.professionalEmail}
                className={CONTROL}
              />
            </Field>
            <Field label="Telephone" htmlFor="professional_phone" className="flex-1">
              <input
                id="professional_phone"
                name="professional_phone"
                defaultValue={organization.professionalPhone}
                className={CONTROL}
              />
            </Field>
          </div>

          <Field label="Office address" htmlFor="office_address">
            <textarea
              id="office_address"
              name="office_address"
              rows={2}
              defaultValue={organization.officeAddress}
              className={AREA}
            />
          </Field>

          <Field label="Where you work" htmlFor="service_areas">
            <input
              id="service_areas"
              name="service_areas"
              defaultValue={organization.serviceAreas}
              placeholder="London, the South East, and wherever a client's estate sits"
              className={CONTROL}
            />
          </Field>
        </Section>

        <Section
          id="internal-rate"
          title="Internal billing rate"
          note="What the firm books its own time at. It is used for your own figures and is never shown to a client or sent to the Client Portal."
        >
          <div className="flex items-end gap-4">
            <Field label={`Rate (${organization.currency})`} htmlFor="internal_rate" className="w-[180px] shrink-0">
              <input
                id="internal_rate"
                name="internal_rate"
                inputMode="decimal"
                defaultValue={rate}
                placeholder="250"
                className={CONTROL}
              />
            </Field>
            <Field label="Per" htmlFor="internal_rate_unit" className="w-[180px] shrink-0">
              <select
                id="internal_rate_unit"
                name="internal_rate_unit"
                defaultValue={organization.internalRateUnit}
                className={CONTROL}
              >
                {RATE_UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Note" htmlFor="internal_rate_note">
            <input
              id="internal_rate_note"
              name="internal_rate_note"
              defaultValue={organization.internalRateNote}
              placeholder="Anything that qualifies it: out of hours, travel, a floor on short work"
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
