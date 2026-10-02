import { SubmitPlain } from "@/base/components/Submit";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { EmailLink, PhoneLink } from "@/whitbyos/components/Reach";
import Link from "next/link";
import {
  removeProviderPerson,
  setProviderPersonPrimary,
} from "@/whitbyos/providers/actions";
import type { ProviderPerson } from "@/whitbyos/lib/provider-people";

/**
 * Everybody at this firm, and which of them is the one to ring.
 *
 * The provider row keeps a single `contact_id` and that is the point of
 * contact; this is the rest of them, held on `company_contacts` the way base
 * always meant them to be. Making somebody primary here sets both, so the
 * panel and the Overview can never say two different names.
 *
 * Removing takes a person off the firm and leaves the person be. A contact is
 * canonical — they may be on a request, a message, a client's file — so
 * unlinking says they no longer work here, which is the thing being recorded.
 */
export function ProviderPeople({
  providerId,
  companyId,
  people,
  here,
}: {
  providerId: string;
  companyId: string;
  people: ProviderPerson[];
  here: string;
}) {
  return (
    <div className="rounded-[10px] border border-line" style={{ background: "var(--surface)" }}>
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.05em]"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-tertiary)",
          background: `color-mix(in srgb, var(--avatar-blue-bg) 38%, var(--surface))`,
        }}
      >
        <span
          aria-hidden
          className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] text-[11px]"
          style={{ background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }}
        >
          ⚇
        </span>
        People ({people.length})
      </div>
      <div className="px-4 py-3.5">

      {people.length === 0 ? (
        <p className="mb-3 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Nobody on file at this firm yet.
        </p>
      ) : (
        <div className="mb-4 flex flex-col">
          {/* Three, then ask. A firm of any size has more people than anybody
              wants to read past on the way to the rest of the record. */}
          <ShowMore step={3}>
          {people.map((person, index) => (
            <div
              key={person.id}
              className="flex items-start justify-between gap-3 py-2.5"
              style={{ borderTop: index === 0 ? undefined : "1px solid var(--border)" }}
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  {/*
                   * The name opens the record, wherever that record is.
                   *
                   * Somebody filed as a provider has their own page, with
                   * everything on it; somebody who is only a contact has a
                   * contact record, which is all there is of them. A name that
                   * is plainly a person and does not open anything is a dead
                   * end on a page whose whole job is to lead somewhere.
                   */}
                  <Link
                    href={
                      person.providerId
                        ? `/whitbyos/providers/${person.providerId}`
                        : `/whitbyos/contacts/${person.contactId}`
                    }
                    className="text-[13px] font-medium no-underline hover:underline"
                    style={{ color: "var(--ink)" }}
                  >
                    {person.name}
                  </Link>
                  {person.isPrimary ? (
                    <span
                      className="rounded-full px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-[0.03em]"
                      style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                    >
                      Point of contact
                    </span>
                  ) : null}
                </div>
                {person.role ? (
                  <div className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                    {person.role}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-x-3 text-[12.5px]">
                  {person.email ? <EmailLink address={person.email} /> : null}
                  {person.phone ? <PhoneLink number={person.phone} /> : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {person.isPrimary ? null : (
                  <form action={setProviderPersonPrimary}>
                    <input type="hidden" name="provider_id" value={providerId} />
                    <input type="hidden" name="company_id" value={companyId} />
                    <input type="hidden" name="contact_id" value={person.contactId} />
                    <SubmitPlain className="text-[12px]" style={{ color: "var(--accent)" }}>
                      Make point of contact
                    </SubmitPlain>
                  </form>
                )}
                {/* A typo in an email had no remedy but removing the person
                    and adding them again, which takes their history with them. */}
                <Link
                  href={`${here}?person=${person.id}`}
                  className="text-[12px] no-underline"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Edit
                </Link>
                <form action={removeProviderPerson}>
                  <input type="hidden" name="provider_id" value={providerId} />
                  <input type="hidden" name="link_id" value={person.id} />
                  <input type="hidden" name="contact_id" value={person.contactId} />
                  <SubmitPlain
                    className="shrink-0 px-0.5 text-[14px] font-bold"
                    title={`Remove ${person.name}`}
                    aria-label={`Remove ${person.name}`}
                    style={{ color: "var(--danger-text)" }}
                  >
                    ✕
                  </SubmitPlain>
                </form>
              </div>
            </div>
          ))}
          </ShowMore>
        </div>
      )}

      {/*
       * The same dialog the directory uses, opened at this firm.
       *
       * Four boxes here and a full form there made two ways of filing one
       * thing, and the person entered the quick way had no category, no
       * readiness and no way to be put in front of a client — a contact
       * wearing a provider's place in the list.
       */}
      <Link
        href={`${here}?addperson=1`}
        className="inline-flex items-center gap-1.5 rounded-control border px-3 py-[7px] text-[12.5px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
        style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}
      >
        <span aria-hidden>+</span>
        Add person
      </Link>
      </div>
    </div>
  );
}
