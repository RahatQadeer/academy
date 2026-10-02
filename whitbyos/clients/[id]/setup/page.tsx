import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { getClientWorkspaceSetup, type SetupPerson } from "@/whitbyos/lib/client-setup";
import { saveClientWorkspaceSetup } from "@/whitbyos/clients/actions";
import { param, type SearchParams } from "@/whitbyos/lib/params";
import { redirectIfNoClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { planIncludesClientPortal } from "@/whitbyos/lib/billing-vocab";
import { getCurrentWorkspacePlan } from "@/whitbyos/lib/workspace";
import { PortalUpgradePrompt } from "@/whitbyos/components/PortalUpgradePrompt";

const LIST = "/whitbyos/clients";

/** The reference's card: a 10px box at --border, which is its own #ececea. */
const CARD = "flex flex-col gap-3 rounded-card border p-5";
const CARD_STYLE = { borderColor: "var(--border)", background: "var(--surface)" };

/**
 * Screen 2.2b — Configure Client Workspace.
 *
 * A page, not a dialog: it is where somebody lands from "Set up now" on 2.2a,
 * and it has its own 76px bar with its own Save & finish in it.
 *
 * Everything on it writes to columns that already exist. The switch is
 * `portal_access`, the email is the primary contact's own, and the two lists
 * are `whitbyos_client_members` rows by role. Nothing here needed a migration.
 *
 * The reference's "+ Add authorized user" and "+ Add member" go nowhere in the
 * export — they are drawn, not designed. They point at the client's Contacts
 * tab here, which is where a person is actually linked to a client, rather
 * than at a control that would do nothing.
 *
 * One departure, and it is the shell rather than the screen. The export draws
 * this with no sidebar; `app/[product]/layout.tsx` wraps every Whitby route in
 * `ProductShell`, and WP.24's document preview already lives inside it for the
 * same reason. Changing that would touch routing shared by all four products,
 * which this screen is not worth. Everything inside the bar matches.
 */
export default async function ClientWorkspaceSetupPage({
  clientId,
  searchParams,
}: {
  clientId: string;
  searchParams?: SearchParams;
}) {
  await redirectIfNoClientWorkspaces();
  const setup = await getClientWorkspaceSetup(clientId);
  if (!setup) notFound();
  const portalOnPlan = planIncludesClientPortal(await getCurrentWorkspacePlan());

  const error = param(searchParams, "error");
  const done = `${LIST}?added=${encodeURIComponent(setup.clientName)}`;
  const contacts = `${LIST}/${setup.clientId}/contacts`;

  return (
    <form action={saveClientWorkspaceSetup} style={{ background: "#f9f9f8" }} className="min-h-full">
      <input type="hidden" name="client_id" value={setup.clientId} />

      <div
        className="flex h-[76px] items-center justify-between border-b px-16"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <span className="text-[14.5px] font-semibold" style={{ color: "var(--ink)" }}>
          Set up {setup.clientName}
        </span>
        {/* The bar's own Save & finish submits the same form as the one at the
            foot of the column, so either can be the one they reach for. */}
        <SubmitPlain className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Save &amp; finish
        </SubmitPlain>
      </div>

      <div className="flex justify-center px-6 pt-9 pb-16">
        <div className="flex w-full max-w-[640px] flex-col gap-6">
          {error ? <Callout tone="danger">{error}</Callout> : null}

          <section className={CARD} style={CARD_STYLE}>
            <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              Client Portal access
            </div>

            {portalOnPlan ? (
              <>
            <label
              className="flex cursor-pointer items-center gap-2 text-[13.5px]"
              style={{ color: "var(--ink)" }}
            >
              <input type="checkbox" name="portal_enabled" defaultChecked={setup.portalEnabled} />
              Enable Client Portal for this workspace
            </label>

            <div className="flex gap-3">
              <input
                name="portal_email"
                type="email"
                defaultValue={setup.portalEmail}
                placeholder="Portal contact email"
                aria-label="Portal contact email"
                className="flex-1 rounded-control border px-3 py-[9px] text-[13.5px]"
                style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
              />
            </div>
              </>
            ) : (
              <PortalUpgradePrompt />
            )}
          </section>

          <PeopleCard
            title="Authorized users"
            addLabel="+ Add authorized user"
            addHref={contacts}
            empty="People who can act on this client's behalf, for example an assistant or co-signer. None added yet."
            people={setup.authorizedUsers}
          />

          <PeopleCard
            title="Additional members"
            addLabel="+ Add member"
            addHref={contacts}
            empty="Other people tied to this workspace, like family members. None added yet."
            people={setup.additionalMembers}
          />

          <div className="flex justify-end gap-2.5">
            <Button unsized href={done} variant="secondary" className="px-[18px] py-2.5 text-[13.5px]">
              Skip the rest
            </Button>
            <Submit unsized variant="primary" className="px-[18px] py-2.5 text-[13.5px]">
              Save &amp; finish
            </Submit>
          </div>
        </div>
      </div>
    </form>
  );
}

/**
 * The second and third cards, which differ only in their words.
 *
 * The reference draws both empty and says so in its sentence. Where somebody
 * has already been linked, their names are what the card should say instead —
 * the sentence would otherwise claim none where there are some.
 */
function PeopleCard({
  title,
  addLabel,
  addHref,
  empty,
  people,
}: {
  title: string;
  addLabel: string;
  addHref: string;
  empty: string;
  people: SetupPerson[];
}) {
  return (
    <section className={CARD} style={CARD_STYLE}>
      <div className="flex items-center justify-between">
        <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
          {title}
        </div>
        <Link
          href={addHref}
          className="text-[12.5px] no-underline"
          style={{ color: "var(--accent)" }}
        >
          {addLabel}
        </Link>
      </div>

      {people.length === 0 ? (
        <p className="text-[12.5px]" style={{ margin: 0, color: "rgba(55,53,47,.55)" }}>
          {empty}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {people.map((person) => (
            <div key={person.id} className="text-[13px]" style={{ color: "var(--ink)" }}>
              {person.name}
              {person.email ? (
                <span className="ml-2 text-[12.5px]" style={{ color: "rgba(55,53,47,.55)" }}>
                  {person.email}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
