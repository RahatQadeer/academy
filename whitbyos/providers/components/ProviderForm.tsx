import { CONTROL, Field } from "@/whitbyos/components/Field";
import { CategorySpecialty } from "@/whitbyos/providers/components/CategorySpecialty";
import { PeopleFields } from "@/whitbyos/providers/components/PeopleFields";
import { ProviderNameField } from "@/whitbyos/providers/components/ProviderNameField";
import { OUTREACH, READINESS, RESPONSES, SOURCES } from "@/whitbyos/lib/provider-vocab";
import type { CategoryOption } from "@/whitbyos/lib/taxonomy";
import type { CompanyOption } from "@/whitbyos/lib/providers";

/**
 * Today, for the two date fields that have a side of it they belong on.
 *
 * A server component, so this is the server's day and no hydration can
 * disagree with it. A person a timezone away may see a bound a few hours off
 * their own midnight, which is a better answer than a field that accepts a
 * last contact next week.
 */
const TODAY = new Date().toISOString().slice(0, 10);

export type Teammate = { id: string; name: string };

export type ClientOption = { id: string; name: string };

export type ProviderValues = {
  name?: string;
  type?: "company" | "individual";
  clientId?: string | null;
  category?: string | null;
  location?: string | null;
  source?: string | null;
  readiness?: string | null;
  outreach?: string | null;
  ownerId?: string | null;
  /** 5.1's own fields, added by migration 051. */
  nextAction?: string | null;
  qualifications?: string | null;
  restrictions?: string | null;
  missingInformation?: string | null;
  lastContactDate?: string | null;
  responseState?: string | null;
  /**
   * Three more the detail screen prints and neither dialog could fill.
   *
   * `specialty_capability`, `last_verified_at` and `next_follow_up_date` have
   * been columns since the schema was written, and 5.1 draws a row for each —
   * Capability under Overview, Last reviewed under Evidence & Review, Next
   * follow-up under Outreach. Nothing anywhere could set them, so every
   * provider ever created read "No capability recorded" and "Not recorded"
   * twice, with no way to answer.
   */
  specialty?: string | null;
  /** What the firm calls them: Partner, Account Manager, Billing. */
  role?: string | null;
  /** The provider's own, not a contact's: `info@`, a switchboard, a website. */
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  firmId?: string | null;
  lastVerifiedAt?: string | null;
  nextFollowUp?: string | null;
};

/**
 * The fields 5.0a and 5.1a share, which is all of them bar the Primary Contact
 * that only Edit carries — you cannot pick a person at a company that does not
 * exist yet.
 *
 * Category is a select over the shared taxonomy — the twenty-five of SRS
 * Section 10, read from `taxonomy_categories` rather than the six that used to
 * be written out here. Specialty is the search beside it, because a category
 * says which shelf somebody is on and only a specialty says what they do.
 */
export function ProviderFields({
  values = {},
  teammates,
  clients,
  showSource = true,
  showNote = true,
  showPeople = false,
  companies,
  firms = [],
  atFirm,
  inherit,
  firmProviderId,
  categories,
  usedSpecialties = [],
  lockType = false,
  worksAt,
  nameLabel = "Provider Name",
  namePlaceholder = "Company or person's name",
}: {
  values?: ProviderValues;
  teammates: Teammate[];
  /** The shared taxonomy, in its own order. */
  categories: CategoryOption[];
  /** What this firm has already called a specialty, offered back to them. */
  usedSpecialties?: string[];
  /** Passed by Add only — 5.1a does not let the client link be changed. */
  clients?: ClientOption[];
  /** 5.1a draws no Source; 5.0a does. */
  showSource?: boolean;
  /**
   * Add offers a first note, because there is no provider to open yet and
   * whatever somebody knows at that moment is what they will forget by the
   * time there is. Edit does not: the detail page under it already holds the
   * notes, all of them, and a box in the dialog that silently appended a new
   * one would look like it was editing the last.
   */
  showNote?: boolean;
  /**
   * Add only. Editing a provider that already exists has the detail page under
   * it, where its people are listed with what they do and which of them is the
   * one to ring; a second list in the dialog would be a different answer to the
   * same question.
   */
  showPeople?: boolean;
  /**
   * Add only. With them, the name field itself says when the firm already
   * holds a company under that name, which is the question the dropdown above
   * it used to ask before anybody had typed anything.
   */
  companies?: CompanyOption[];
  /** Provider companies an individual can be placed at. */
  firms?: { id: string; name: string }[];
  /**
   * Adding from inside a firm. The type is then not a question — a firm does
   * not work at a firm — so it is stated rather than asked, and Works at
   * opens on the firm it was opened from.
   */
  atFirm?: { id: string; name: string } | null;
  /**
   * The firm's own answers, carried rather than re-asked.
   *
   * Category, service area, how they were found and where the relationship
   * stands were all settled when the firm was filed. Asking a partner at that
   * firm for them again is asking a question whose answer is already on the
   * screen behind the dialog, and the answer that comes back is whatever the
   * person typing felt like putting.
   */
  inherit?: {
    category?: string | null;
    location?: string | null;
    source?: string | null;
    readiness?: string | null;
    outreach?: string | null;
  };
  /** The firm's provider row, so a new person can be made its contact. */
  firmProviderId?: string | null;
  /**
   * Edit. Type is decided when they are filed and is not a question afterwards
   * — a person at a firm is still a person, not a second company, and flipping
   * the radio would look as if it could take them off that firm.
   */
  lockType?: boolean;
  /** The firm an individual works at, named on the locked type. */
  worksAt?: string | null;
  nameLabel?: string;
  namePlaceholder?: string;
}) {
  /*
   * Somebody inside a firm is asked only what is theirs.
   *
   * Name, what they are called there, what they personally do, how to reach
   * them, what is next with them, and anything worth writing down. Everything
   * else the firm already answers, and their own page holds the full record
   * when it is ever needed.
   */
  if (atFirm) {
    return (
      <>
        <input type="hidden" name="type" value="individual" />
        <input type="hidden" name="firm_id" value={atFirm.id} />
        <input type="hidden" name="client_id" value={values.clientId ?? ""} />
        <input type="hidden" name="owner" value={values.ownerId ?? ""} />
        <input type="hidden" name="location" value={inherit?.location ?? values.location ?? ""} />
        <input type="hidden" name="source" value={inherit?.source ?? "existing_relationship"} />
        <input type="hidden" name="readiness" value={inherit?.readiness ?? values.readiness ?? "prospect"} />
        <input type="hidden" name="outreach" value={inherit?.outreach ?? values.outreach ?? "not_started"} />
        {firmProviderId ? (
          <input type="hidden" name="firm_provider_id" value={firmProviderId} />
        ) : null}

        <Field label={nameLabel} htmlFor="name" required>
          <input
            id="name"
            name="name"
            required
            autoComplete="off"
            defaultValue={values.name ?? ""}
            placeholder="Their name"
            className={CONTROL}
          />
        </Field>

        <div className="flex gap-3">
          <Field label="Role" htmlFor="role" className="flex-1">
            <input
              id="role"
              name="role"
              autoComplete="off"
              defaultValue={values.role ?? ""}
              placeholder="Partner, Account Manager, Billing"
              className={CONTROL}
            />
          </Field>
          <Field label="Email" htmlFor="email" className="flex-1">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="off"
              title="Something like omar@ahmedpartners.co.uk"
              defaultValue={values.email ?? ""}
              placeholder="Their email"
              className={CONTROL}
            />
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="Phone" htmlFor="phone" className="flex-1">
            <input
              id="phone"
              name="phone"
              autoComplete="off"
              inputMode="tel"
              pattern="[+()\-.\s0-9]{7,}"
              title="Digits, spaces and + only"
              defaultValue={values.phone ?? ""}
              placeholder="Their number"
              className={CONTROL}
            />
          </Field>
          <div className="flex-1">
            <CategorySpecialty
              categories={categories}
              used={usedSpecialties}
              category={inherit?.category ?? values.category ?? null}
              specialty={values.specialty}
              specialtyOnly
            />
          </div>
        </div>

        <Field label="Next action" htmlFor="next_action">
          <input
            id="next_action"
            name="next_action"
            autoComplete="off"
            defaultValue={values.nextAction ?? ""}
            placeholder="What happens next with them"
            className={CONTROL}
          />
        </Field>

        {showNote ? (
          <Field label="Notes" htmlFor="note">
            <textarea
              id="note"
              name="note"
              rows={2}
              placeholder="Anything worth remembering. Internal only."
              className="w-full resize-y rounded-[8px] border px-3 py-2 text-[13px] leading-[1.5] outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
            />
          </Field>
        ) : null}

        <label
          className="flex cursor-pointer items-center gap-2 text-[13px]"
          style={{ color: "var(--text-secondary)" }}
        >
          <input type="checkbox" name="as_contact" value="1" />
          Make them the point of contact
        </label>
      </>
    );
  }

  return (
    <>
      {/*
       * Type is asked once, when they are added.
       *
       * The two are not interchangeable afterwards. Offering the radios on
       * Edit made it look as if ticking Company would turn a partner into a
       * firm of their own and take them off the one they work at. It does
       * not, and it must not appear to.
       */}
      {lockType ? (
        <Field label="Provider type">
          <input
            type="hidden"
            name="type"
            value={values.type === "individual" ? "individual" : "company"}
          />
          <div
            className="rounded-control border border-line px-3 py-[9px] text-[13.5px]"
            style={{ background: "var(--surface-soft)", color: "var(--ink)" }}
          >
            {values.type === "individual"
              ? worksAt
                ? `Individual at ${worksAt}`
                : "Individual"
              : "Company"}
          </div>
          <p
            className="text-[12px] leading-[1.5]"
            style={{ margin: "6px 0 0", color: "var(--text-tertiary)" }}
          >
            Set when they were added. A person stays a person; a company stays
            a company.
          </p>
        </Field>
      ) : (
        <Field label="Provider Type" htmlFor="type-company">
          <div className="flex gap-2">
            {(["company", "individual"] as const).map((option) => (
              <label
                key={option}
                className="flex flex-1 cursor-pointer items-center gap-[7px] rounded-control border border-line-strong px-3 py-[9px] text-[13.5px] capitalize"
              >
                <input
                  id={`type-${option}`}
                  type="radio"
                  name="type"
                  value={option}
                  defaultChecked={(values.type ?? "company") === option}
                  className="m-0"
                />
                {option}
              </label>
            ))}
          </div>
        </Field>
      )}

      {companies ? (
        <ProviderNameField
          label={nameLabel}
          placeholder={namePlaceholder}
          companies={companies}
          defaultValue={values.name ?? ""}
        />
      ) : (
        <Field label={nameLabel} htmlFor="name" required>
          <input
            id="name"
            name="name"
            required
            defaultValue={values.name ?? ""}
            placeholder={namePlaceholder}
            className={CONTROL}
          />
        </Field>
      )}

      {/*
       * "Available to", not "Link to (optional)".
       *
       * A provider is always for somebody — every client the firm has, or one
       * of them. Both are answers, so calling the field optional was wrong
       * twice over: there is no blank state to leave it in, and "None" was the
       * name being given to "all of them", which is the opposite of what it
       * says. The field asks who can see them, and both options answer it.
       */}

      {clients && clients.length > 0 ? (
        <Field label="Available to" htmlFor="client_id">
          <select
            id="client_id"
            name="client_id"
            defaultValue={values.clientId ?? ""}
            className={`${CONTROL} text-[13.5px]`}
          >
            {/* Not "All clients": that is already the name of the view you
                choose on Workspace Overview, and half the product tells people
                to go and choose it. A provider labelled with it reads as
                belonging to that view rather than to everybody. */}
            <option value="">Any client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} only
              </option>
            ))}
          </select>

          {/*
           * Under the field, because the answer is not obvious from the two
           * options and getting it wrong is quiet: a provider filed to one
           * client is simply missing from everybody else's directory, with
           * nothing anywhere saying why.
           */}
          <p
            className="mt-1.5 text-[12px] leading-[1.5]"
            style={{ margin: "6px 0 0", color: "var(--text-tertiary)" }}
          >
            Any client for somebody the firm uses generally, like a mover or
            an accountant. One client when the provider is theirs alone: a
            nanny at their house, a lawyer on their matter.
          </p>
        </Field>
      ) : null}

      {showPeople ? <PeopleFields firms={firms} /> : null}

      <CategorySpecialty
        categories={categories}
        used={usedSpecialties}
        category={values.category}
        specialty={values.specialty}
        location={values.location}
      />

      {showSource ? (
      <Field label="Source" htmlFor="source">
        <select
          id="source"
          name="source"
          defaultValue={values.source ?? "existing_relationship"}
          className={`${CONTROL} text-[13.5px]`}
        >
          {SOURCES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      ) : null}

      <div className="flex gap-3">
        <Field label="Readiness" htmlFor="readiness" className="flex-1">
          <select
            id="readiness"
            name="readiness"
            defaultValue={values.readiness ?? "prospect"}
            className={`${CONTROL} text-[13.5px]`}
          >
            {READINESS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Outreach State" htmlFor="outreach" className="flex-1">
          <select
            id="outreach"
            name="outreach"
            defaultValue={values.outreach ?? "not_started"}
            className={`${CONTROL} text-[13.5px]`}
          >
            {OUTREACH.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* 5.1 prints these under Overview, Evidence & Review and Outreach.
          They are what somebody types about a relationship, so they are typed
          here rather than derived anywhere. */}
      <Field label="Next action" htmlFor="next_action">
        <input
          id="next_action"
          name="next_action"
          autoComplete="off"
          defaultValue={values.nextAction ?? ""}
          placeholder="What happens next"
          className={CONTROL}
        />
      </Field>

      {/*
       * The provider's own way in. A company reached only through whichever
       * contact happened to be linked to it, and an individual through nothing
       * at all.
       *
       * `autoComplete="off"` throughout, because every field on this form is
       * somebody else's detail. Left on, the browser fills a provider's
       * website with whatever it last saw in a box on this page, and a
       * provider's email with the reader's own — wrong in a way nobody checks,
       * because a filled field looks like a saved one.
       */}
      <div className="flex gap-3">
        <Field label="Email" htmlFor="email" className="flex-1">
          <input
            id="email"
            name="email"
            autoComplete="off"
            type="email"
            title="Something like info@ahmedpartners.co.uk"
            defaultValue={values.email ?? ""}
            placeholder="General email"
            className={CONTROL}
          />
        </Field>
        <Field label="Phone" htmlFor="phone" className="flex-1">
          <input
            id="phone"
            name="phone"
            inputMode="tel"
            pattern="[+()\-.\s0-9]{7,}"
            title="Digits, spaces and + only"
            autoComplete="off"
            defaultValue={values.phone ?? ""}
            placeholder="Main number"
            className={CONTROL}
          />
        </Field>
      </div>

      <Field label="Website" htmlFor="website">
        <input
          id="website"
          name="website"
          autoComplete="off"
          defaultValue={values.website ?? ""}
          placeholder="example.com"
          className={CONTROL}
        />
      </Field>

      {/* Distinct from Location, which is the area they serve. */}
      <Field label="Address" htmlFor="address">
        <textarea
          id="address"
          name="address"
          autoComplete="off"
          rows={2}
          defaultValue={values.address ?? ""}
          placeholder="Street, city, postcode, country"
          className="w-full resize-y rounded-[8px] border px-3 py-2 text-[13px] leading-[1.5] outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
        />
      </Field>

      {showNote ? (
        <Field label="Notes" htmlFor="note">
          <textarea
            id="note"
            name="note"
            rows={3}
            placeholder="Anything worth remembering. Internal only."
            className="w-full resize-y rounded-[8px] border px-3 py-2 text-[13px] leading-[1.5] outline-none focus:border-[var(--accent)]"
            style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
          />
        </Field>
      ) : null}

      <Field label="Qualifications" htmlFor="qualifications">
        <input
          id="qualifications"
          name="qualifications"
          autoComplete="off"
          defaultValue={values.qualifications ?? ""}
          placeholder="What makes them credible"
          className={CONTROL}
        />
      </Field>

      <div className="flex gap-3">
        <Field label="Restrictions" htmlFor="restrictions" className="flex-1">
          <input
            id="restrictions"
            name="restrictions"
            autoComplete="off"
            defaultValue={values.restrictions ?? ""}
            placeholder="What they will not do"
            className={CONTROL}
          />
        </Field>

        <Field label="Missing information" htmlFor="missing_information" className="flex-1">
          <input
            id="missing_information"
            name="missing_information"
            autoComplete="off"
            defaultValue={values.missingInformation ?? ""}
            placeholder="What has not been checked"
            className={CONTROL}
          />
        </Field>
      </div>

      <Field label="Last reviewed" htmlFor="last_verified_at">
        <input
          id="last_verified_at"
          name="last_verified_at"
          type="date"
          // Nobody reviewed a provider tomorrow.
          max={TODAY}
          defaultValue={values.lastVerifiedAt ? values.lastVerifiedAt.slice(0, 10) : ""}
          className={CONTROL}
        />
      </Field>

      <div className="flex gap-3">
        <Field label="Last contact" htmlFor="last_contact_date" className="flex-1">
          <input
            id="last_contact_date"
            name="last_contact_date"
            type="date"
            // A last contact in the future is not a last contact. The field
            // took one before this, and the detail screen printed it.
            max={TODAY}
            defaultValue={values.lastContactDate ? values.lastContactDate.slice(0, 10) : ""}
            className={CONTROL}
          />
        </Field>

        <Field label="Response state" htmlFor="response_state" className="flex-1">
          <select
            id="response_state"
            name="response_state"
            defaultValue={values.responseState ?? ""}
            className={`${CONTROL} text-[13.5px]`}
          >
            <option value="">Not recorded</option>
            {RESPONSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Next follow-up" htmlFor="next_follow_up_date">
        <input
          id="next_follow_up_date"
          name="next_follow_up_date"
          type="date"
          // Forward only: a follow-up already behind you is a last contact.
          min={TODAY}
          defaultValue={values.nextFollowUp ? values.nextFollowUp.slice(0, 10) : ""}
          className={CONTROL}
        />
      </Field>

      <Field label="Relationship Owner" htmlFor="owner">
        <select
          id="owner"
          name="owner"
          defaultValue={values.ownerId ?? ""}
          className={`${CONTROL} text-[13.5px]`}
        >
          <option value="">No one yet</option>
          {teammates.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
