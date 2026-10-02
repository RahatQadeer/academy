/**
 * Turning the role a drafter suggested into a person who actually works here.
 *
 * The model has never met the team, so it is asked for a kind of person rather
 * than a name — and the matching is done here, against `workspace_members`,
 * because who is in a workspace is a fact and not a judgement.
 *
 * Every plan, Work Stream and task used to be owned by whoever pressed the
 * button, however many people were in the firm. That is not an assignment, it
 * is a default wearing one's clothes.
 *
 * Where nothing suitable is in the workspace, the task comes back unassigned
 * and says so. Putting it on the wrong person is worse than leaving it open:
 * an unassigned task gets picked up, and a wrongly assigned one gets ignored
 * by the person it was meant for and never seen by the person it landed on.
 */

export type Assignable = {
  userId: string;
  role: string;
};

/**
 * Which roles can stand in for which, best first.
 *
 * A firm of two has no billing specialist, and refusing to schedule the
 * invoice step over it would be silly. Every chain ends at the owner, who can
 * always do anything — it is their firm.
 */
const FALLBACK: Record<string, string[]> = {
  owner: ["owner", "admin"],
  admin: ["admin", "owner"],
  team_lead: ["team_lead", "admin", "owner"],
  coordinator: ["coordinator", "team_lead", "admin", "owner"],
  billing: ["billing", "admin", "owner"],
  any: ["coordinator", "team_lead", "admin", "owner"],
};

export async function listAssignable(workspaceId: string): Promise<Assignable[]> {
  // Imported here rather than at the top so the policy below — which is the
  // part worth testing — can be loaded without pulling in the server client.
  const { createClient } = await import("@/base/lib/supabase/server");
  const supabase = await createClient();

  const { data } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  return (data ?? [])
    .map((row) => ({ userId: row.user_id as string, role: (row.role as string) ?? "" }))
    .filter((row) => Boolean(row.userId));
}

/**
 * Spread the work rather than piling it on the first match.
 *
 * `taken` counts what has already been handed out in this plan, so where two
 * coordinators could both do a step, the one with less of it gets it.
 *
 * A named role and "any" are different questions, and they used to get the
 * same answer. Both walked the chain, stopped at the first role anybody held,
 * and balanced inside that one tier — so in a firm of an owner and one team
 * lead, every "any" step landed on the team lead, because team_lead comes
 * first in that chain and there is only one of them. Fifteen of fifteen, on a
 * plan that had said nothing about who should do the work.
 *
 * So "any" now means any: everyone the chain admits is in the running, and the
 * one carrying least gets it. A named role stays a preference — spreading a
 * billing step onto the owner while a billing person sits idle is not sharing
 * the load, it is ignoring what was asked for.
 */
export function assignRole(
  role: string | undefined,
  people: Assignable[],
  taken: Map<string, number>,
): string | null {
  if (people.length === 0) return null;

  const wanted = FALLBACK[role ?? "any"] ?? FALLBACK.any!;
  const rank = new Map(wanted.map((name, index) => [name, index]));

  /**
   * An exact match is honoured; a substitution is shared.
   *
   * Asking for billing when somebody holds billing is a request, and it wins
   * outright. Asking for a coordinator in a firm that has none is already a
   * compromise — and answering every one of those with the first substitute
   * put every task on the same person: on a plan of nine, the owner got none
   * of them while the one team lead got all nine. Once we are substituting,
   * the chain is a list of people who could each do it, so the one carrying
   * least does.
   */
  const exact = role && role !== "any" ? people.filter((person) => person.role === role) : [];
  const chain = people.filter((person) => rank.has(person.role));

  /**
   * An exact match holds, until it stops being fair.
   *
   * "Billing work goes to the billing person" is right, and stays right for a
   * plan with two invoices on it. It stops being right when a plan asks for
   * the same role fifteen times in a firm that has one of them: the answer is
   * then one person holding the entire plan while everybody the fallback chain
   * names as able to do it holds nothing.
   *
   * So the exact match gives way once its load is three clear of the least
   * loaded person the chain admits. Three rather than one, because a
   * preference that yields at the first opportunity is not a preference.
   */
  const load = (person: Assignable) => taken.get(person.userId) ?? 0;
  const lightest = (group: Assignable[]) =>
    group.reduce((least, person) => (load(person) < load(least) ? person : least), group[0]!);

  const overloaded =
    exact.length > 0 &&
    chain.length > exact.length &&
    load(lightest(exact)) - load(lightest(chain)) >= 3;

  const pool = exact.length > 0 && !overloaded ? exact : chain;

  if (pool.length === 0) return null;

  // Load first, then the chain's own preference, then the id — so the same
  // plan drafted twice hands out the same work.
  return pool
    .slice()
    .sort(
      (a, b) =>
        (taken.get(a.userId) ?? 0) - (taken.get(b.userId) ?? 0) ||
        rank.get(a.role)! - rank.get(b.role)! ||
        a.userId.localeCompare(b.userId),
    )[0]!.userId;
}


/** What the screen says where nothing matched. */
export const NEEDS_ASSIGNMENT = "Assignment required";
