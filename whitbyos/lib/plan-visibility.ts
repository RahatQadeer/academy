import { createClient } from "@/base/lib/supabase/server";
import { listTeam } from "@/whitbyos/lib/settings";

/**
 * WP.17v and WP.17u — who on the team can see a Work Plan, or one Work Stream.
 *
 * Both modals are the same list drawn twice: every active member of the
 * workspace, with a tick against the ones who may see the thing. Invitees are
 * left out on purpose — they have no account yet, so there is no id to record
 * and nothing for them to sign in and see.
 *
 * **An empty stored set means everyone**, which is what migration 070 records
 * and why it does so: a row is an allow-list entry, so treating "no rows" as
 * "nobody" would have hidden every plan that existed before the feature did.
 * Nothing is decided until somebody unticks a name.
 *
 * The owner is always included and cannot be removed. The modal still draws
 * their checkbox, ticked, because the reference does — it is simply not a
 * question, in the same way a plan cannot be taken away from the person
 * answerable for it.
 */
export type VisibilityPerson = {
  userId: string;
  name: string;
  /** "Owner" for the plan's owner, otherwise their workspace role. */
  roleLabel: string;
  isOwner: boolean;
  checked: boolean;
};

export type VisibilityList = {
  /** What the dialog is about — a plan's name, or a stream's. */
  subject: string;
  people: VisibilityPerson[];
  /**
   * The client-portal switch under the list (client-portal/013). Null where
   * those columns are not there yet, so the dialog offers no switch that
   * cannot be saved.
   */
  client: ClientShare | null;
};

/**
 * Whether the client sees this in their portal.
 *
 * A plan is shared or not. A stream of a shared plan is shown unless it was
 * taken out — hiding is the per-stream act, because sharing a plan means
 * sharing its streams.
 */
export type ClientShare = {
  /** Plan: shared with the client. Stream: not hidden from them. */
  checked: boolean;
  /** Whether the plan is shared — a stream's switch does nothing until it is. */
  planShared: boolean;
  /** The portal never shows a draft, shared or not. */
  planDraft: boolean;
};

/**
 * Whether a plan is shared with the client, read on its own.
 *
 * Separate from every other read of the plan because the column arrives with
 * client-portal/013, and PostgREST answers a request naming a missing column
 * with an error and no row. Folded into `getWorkPlan`'s select it would take
 * the whole plan screen down on any environment that migration has not reached.
 */
export async function readPlanClientShare(
  planId: string,
): Promise<{ sharedAt: string | null; draft: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whitbyos_workplans")
    .select("client_shared_at, status")
    .eq("id", planId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    sharedAt: (data.client_shared_at as string | null) ?? null,
    draft: String(data.status).toLowerCase() === "draft",
  };
}

/** The workspace's members, with the ticks a stored allow-list implies. */
async function resolve(
  ownerUserId: string | null,
  allowed: string[],
): Promise<VisibilityPerson[]> {
  const team = await listTeam();
  // Nothing decided yet: everyone sees it, which is how it behaved before
  // this table existed.
  const undecided = allowed.length === 0;
  const allow = new Set(allowed);

  return team
    .filter((member) => member.status === "active" && member.userId)
    .map((member) => {
      const userId = member.userId as string;
      const isOwner = userId === ownerUserId;
      return {
        userId,
        name: member.name,
        roleLabel: isOwner ? "Owner" : member.roleLabel,
        isOwner,
        checked: isOwner || undecided || allow.has(userId),
      };
    });
}

/** WP.17v — the whole plan. */
export async function readPlanVisibility(planId: string): Promise<VisibilityList | null> {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("id, name, owner_user_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return null;

  const [{ data: rows }, share] = await Promise.all([
    supabase.from("whitbyos_workplan_viewers").select("user_id").eq("workplan_id", planId),
    readPlanClientShare(planId),
  ]);

  return {
    subject: (plan.name as string) ?? "this Work Plan",
    people: await resolve(
      (plan.owner_user_id as string | null) ?? null,
      (rows ?? []).map((row) => row.user_id as string),
    ),
    client: share
      ? {
          checked: Boolean(share.sharedAt),
          planShared: Boolean(share.sharedAt),
          planDraft: share.draft,
        }
      : null,
  };
}

/**
 * WP.17u — one stream.
 *
 * Scoped to the plan as well as the stream so a stream id from another plan
 * cannot be opened through this dialog; the page passes both.
 */
export async function readStreamVisibility(
  planId: string,
  streamId: string,
): Promise<VisibilityList | null> {
  const supabase = await createClient();

  const { data: stream } = await supabase
    .from("whitbyos_workstreams")
    .select("id, name, owner_user_id")
    .eq("id", streamId)
    .eq("workplan_id", planId)
    .maybeSingle();
  if (!stream) return null;

  const [{ data: rows }, share, hidden] = await Promise.all([
    supabase.from("whitbyos_workstream_viewers").select("user_id").eq("workstream_id", streamId),
    readPlanClientShare(planId),
    // Its own read for the same reason `readPlanClientShare` is one.
    supabase.from("whitbyos_workstreams").select("client_hidden").eq("id", streamId).maybeSingle(),
  ]);

  return {
    subject: (stream.name as string) ?? "this Work Stream",
    people: await resolve(
      (stream.owner_user_id as string | null) ?? null,
      (rows ?? []).map((row) => row.user_id as string),
    ),
    client:
      share && !hidden.error && hidden.data
        ? {
            checked: !hidden.data.client_hidden,
            planShared: Boolean(share.sharedAt),
            planDraft: share.draft,
          }
        : null,
  };
}
