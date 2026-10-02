import { portalDefaultAreas } from "@/whitbyos/lib/portal-defaults";
import { PanelAction } from "@/client-portal/components/Panel";
import { Callout } from "@/base/components/Callout";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { listAccessRequests, listPeople } from "@/client-portal/lib/data/people";
import { flag, type ScreenProps } from "@/client-portal/lib/routing";
import { DataNotice } from "@/client-portal/components/DataNotice";

import { SettingsShell } from "../components/SettingsShell";
import { PeopleRoster } from "./components/PeopleRoster";
import { AccessRequestList } from "./components/AccessRequestList";
import { AddPersonModal } from "./components/AddPersonModal";
import { YourAccess } from "./components/YourAccess";

const PATH = "/client-portal/settings/people";

export default async function PeopleSettingsScreen({ searchParams }: ScreenProps) {
  const context = await getPortalContext();

  // The page is reachable by anyone with a login; the *roster* is the part the
  // `people` area gates. Splitting it here rather than in `routes.tsx` is what
  // lets somebody without the area still read what their own access is — which
  // is the one question this screen answers about the reader rather than about
  // the account, and the question every other "not part of your access" screen
  // sends them here to answer.
  const canSeeRoster = context.areas.people;

  // Not fetched at all when it cannot be shown. A list that is filtered out in
  // the markup has still been read out of the database, and the row-level
  // policies are the wrong place to be relying on a component to be careful.
  const [people, requests] = canSeeRoster
    ? await Promise.all([listPeople(), listAccessRequests()])
    : [[], []];

  const { capabilities } = context;

  // One roster — `PeopleRoster` puts it in the order the account reads. The
  // asks still with the professional go in it too, in the place an approved
  // one would land; the answered ones are history and get a band of their own.
  const pending = requests.filter((request) => request.status === "pending");
  const decided = requests.filter((request) => request.status !== "pending");

  const additionalCount = people.filter(
    (person) => person.role === "additional_member",
  ).length;
  const authorizedCount = people.filter(
    (person) => person.role === "authorized_user",
  ).length;

  // A ceiling only bites where one was set. `maxAdditionalMembers` is null when
  // the professional has set no number — which is every account today, since
  // nothing in WhitbyOS writes those columns — and "not set" must not read as
  // "none allowed" or nobody could ever ask for anybody.
  const atAdditionalCeiling =
    capabilities.maxAdditionalMembers !== null &&
    additionalCount >= capabilities.maxAdditionalMembers;
  const atAuthorizedCeiling =
    capabilities.maxAuthorizedUsers !== null &&
    authorizedCount >= capabilities.maxAuthorizedUsers;
  const atCeiling = atAdditionalCeiling && atAuthorizedCeiling;

  // A view-only member may see who is on the account and what each of them
  // reaches, and ask for nobody. Asking for access is a change to the account,
  // and view only is the one grant that permits none.
  const canRequest =
    canSeeRoster &&
    capabilities.mayRequestAccess &&
    !atCeiling &&
    !context.viewOnly;

  const addButton = canRequest ? (
    <PanelAction href={`${PATH}?add=1`}>+ Add someone</PanelAction>
  ) : null;

  /*
   * How much room is left, beside the control that uses it up.
   *
   * It was a sentence at the very bottom of the pane, under five lists — which
   * is the one place a reader deciding whether to ask for somebody is not
   * looking. Only the ceilings the professional actually set are printed:
   * "not set" must not read as "none allowed", or nobody could ever ask for
   * anybody.
   */
  const seats = [
    capabilities.maxAdditionalMembers === null
      ? null
      : `${additionalCount} of ${capabilities.maxAdditionalMembers} additional`,
    capabilities.maxAuthorizedUsers === null
      ? null
      : `${authorizedCount} of ${capabilities.maxAuthorizedUsers} authorized`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SettingsShell
      active="people"
      title="People & Access"
      width={920}
      description={
        canSeeRoster
          ? "Who is on this account and what they can see. You can ask for someone to be added, your team reviews every request."
          : "What your access to this account covers."
      }
    >
      <DataNotice context={context} />

      <YourAccess context={context} />

      {!canSeeRoster ? (
        <Callout tone="info" className="mb-5">
          Seeing who else is on this account is not part of your access. Your
          own access is above, and your team can tell you about anyone else on
          the account.
        </Callout>
      ) : context.viewOnly ? (
        <Callout tone="info" className="mb-5">
          Your access to this account is view only. You can see who is on it and
          what each person can reach, and your team makes any changes.
        </Callout>
      ) : !capabilities.mayRequestAccess ? (
        <Callout tone="info" className="mb-5">
          Your team manages who has access to this account. Contact them to add
          someone.
        </Callout>
      ) : atCeiling ? (
        <Callout tone="info" className="mb-5">
          This account has reached the number of people your team has enabled.
          Contact them if you need to add someone else.
        </Callout>
      ) : null}

      {canSeeRoster ? (
        <>
          {/* The heading, what is left, and the way to use it — one row, where
              the decision is made. */}
          <div className="mb-3 mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2
              className="text-[12.5px] font-semibold uppercase tracking-[0.04em]"
              style={{ color: "var(--text-faint)" }}
            >
              On this account
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {seats ? (
                <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  {seats}
                </span>
              ) : null}
              {addButton}
            </div>
          </div>

          <PeopleRoster
            people={people}
            pending={pending}
            youContactId={context.contactId}
          />

          {/* Answered asks. Below the account itself and closed, because once a
              request is approved the person is a row above in their own right,
              and once it is declined it is history rather than a pending ask. */}
          {decided.length > 0 ? (
            <details className="cp-band mt-4 overflow-hidden rounded-card-cp border border-line bg-surface">
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3">
                <span className="cp-band-caret shrink-0" aria-hidden>
                  ›
                </span>
                <span className="text-[13px] font-semibold">Answered requests</span>
                <span
                  className="ml-auto text-[12.5px] tabular-nums"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {decided.length}
                </span>
              </summary>
              <div className="border-t border-line">
                <AccessRequestList requests={decided} />
              </div>
            </details>
          ) : null}
        </>
      ) : null}

      {flag(searchParams, "add") && canRequest ? (
        <AddPersonModal
          closeHref={PATH}
          returnTo={PATH}
          defaultAreas={await portalDefaultAreas(context.workspaceId)}
        />
      ) : null}
    </SettingsShell>
  );
}

