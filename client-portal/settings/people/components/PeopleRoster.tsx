import { Avatar } from "@/base/components/Avatar";
import { Pill } from "@/base/components/Pill";
import { AREA_LABEL } from "@/client-portal/lib/access";
import { ROLE_LABEL } from "@/client-portal/lib/data/people";
import { relativeTime } from "@/client-portal/lib/format";
import { RowList } from "@/client-portal/components/Surface";
import { EmptyNote } from "@/client-portal/components/States";
import { AreaChips } from "./AreaChips";
import type { AccessRequest, PortalPerson } from "@/client-portal/types";

/**
 * Everyone on the account, in one list.
 *
 * WHAT IT REPLACED
 *
 * Four lists under four headings — Primary Member, Additional Members, Pending
 * Invitations, Dependents — each with its own empty state, on a pane that
 * already carried a card about the reader's own access and a fifth list of
 * answered requests underneath. On the ordinary account, which has one person
 * on it, that was five headings and four sentences explaining that there was
 * nobody to put under them. The headings were also doing the work a row can do
 * for itself: "Additional Member" is a fact about a person, and a person can
 * carry it.
 *
 * So it is one list, ordered the way the account reads — the person holding it,
 * the people with a login, the people who have been asked for, and the people
 * recorded without one — and each row says which it is.
 *
 * A PENDING ASK IS A ROW, NOT A SECTION
 *
 * Somebody the client has asked for is on this account as far as the client is
 * concerned: they asked, and they are waiting. Drawn here in their place in the
 * order, marked as waiting, they answer "did that go through?" where the reader
 * is already looking — which is what a separate "Pending Invitations" heading
 * further down the page was for, at the cost of a heading and a hunt.
 *
 * Answered requests are not here. Once one is approved the person is a row
 * above in their own right, and once it is declined it is history; the pane
 * keeps them in a band of their own that opens if anybody wants them.
 */
export function PeopleRoster({
  people,
  pending,
  youContactId = null,
}: {
  people: PortalPerson[];
  /** Asks still with the professional, drawn in the order they would land in. */
  pending: AccessRequest[];
  /** The reader's own contact, so their row can be marked "(You)". */
  youContactId?: string | null;
}) {
  if (people.length === 0 && pending.length === 0) {
    return (
      <EmptyNote>
        Nobody is on this account yet. Your team holds the account record —
        contact them if this looks wrong.
      </EmptyNote>
    );
  }

  const rank: Record<PortalPerson["role"], number> = {
    primary_member: 0,
    additional_member: 1,
    authorized_user: 1,
    dependent: 3,
  };
  const ordered = [...people].sort((a, b) => rank[a.role] - rank[b.role]);

  // Between the people with a login and the people without one, which is where
  // an approved ask would appear.
  const before = ordered.filter((person) => rank[person.role] < 3);
  const after = ordered.filter((person) => rank[person.role] === 3);

  return (
    <RowList>
      {before.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          isYou={Boolean(youContactId) && person.contactId === youContactId}
        />
      ))}
      {pending.map((request) => (
        <PendingRow key={request.id} request={request} />
      ))}
      {after.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          isYou={Boolean(youContactId) && person.contactId === youContactId}
        />
      ))}
    </RowList>
  );
}

/**
 * One person: who they are, what they are on the account, what they reach.
 *
 * The areas are drawn under the name rather than folded into a one-line
 * summary beside it. "Requests, Messages and Documents" answers what somebody
 * has; it does not answer what they have *not*, and on a screen whose whole
 * subject is permissions that is the more useful half.
 *
 * Three people are exceptions and say so in words instead. The primary member
 * holds the account, so nine chips against them describe a restriction nobody
 * imposed. So does a membership with nothing recorded on it. And a dependent
 * has no login at all — there is no portal for them to reach any of it in.
 */
function PersonRow({ person, isYou }: { person: PortalPerson; isYou: boolean }) {
  const holdsEverything = person.role === "primary_member" || person.areasInherited;

  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
      <Avatar name={person.name} src={person.photoUrl} size={32} />

      <div className="min-w-[min(100%,220px)] flex-1">
        <div className="text-[13.5px] font-semibold leading-[18px]">
          {person.name}
          {isYou ? (
            <span className="font-normal" style={{ color: "var(--text-tertiary)" }}>
              {" "}
              (You)
            </span>
          ) : null}
        </div>

        {/* What they are on the account, and how to reach them, on one line.
            The role used to be the heading this row sat under. */}
        <div className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {[person.relationship, ROLE_LABEL[person.role], person.email]
            .filter(Boolean)
            .join(" · ")}
        </div>

        <div className="mt-1.5">
          {!person.portalAccess ? (
            <span className="text-[12.5px]" style={{ color: "var(--text-quiet)" }}>
              Recorded on the account, without a portal login.
            </span>
          ) : holdsEverything ? (
            <span className="text-[12.5px]" style={{ color: "var(--text-quiet)" }}>
              Every area of the portal.
            </span>
          ) : (
            <AreaChips areas={person.areas} viewOnly={person.viewOnly} />
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {person.viewOnly && person.portalAccess ? <Pill tone="neutral">View only</Pill> : null}
        {person.portalAccess ? (
          <Pill tone="success">Active</Pill>
        ) : (
          <Pill tone="neutral">No login</Pill>
        )}
      </div>
    </div>
  );
}

/**
 * Somebody who has been asked for and not yet decided on.
 *
 * It says what was *asked* for rather than what was granted, because nothing
 * has been: the professional sets the real permissions on approval and may
 * narrow them. The state pill is the whole point of the row — "waiting on your
 * team" is the answer to the only question anybody opens it with.
 */
function PendingRow({ request }: { request: AccessRequest }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
      <Avatar name={request.personName} size={32} />

      <div className="min-w-[min(100%,220px)] flex-1">
        <div className="text-[13.5px] font-semibold leading-[18px]">{request.personName}</div>

        <div className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {[request.relationship, request.requestedRole, request.personEmail]
            .filter(Boolean)
            .join(" · ")}
        </div>

        <div className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-quiet)" }}>
          {request.requestedAreas.length > 0
            ? `Asked for ${request.requestedAreas.map((area) => AREA_LABEL[area]).join(", ")}`
            : "Asked for no areas in particular"}
          {` · sent ${relativeTime(request.createdAt)}`}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Pill tone="warning">Waiting on your team</Pill>
      </div>
    </div>
  );
}
