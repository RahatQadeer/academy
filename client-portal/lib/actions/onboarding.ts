"use server";

import { IN_APP, notifyWorkspaceMembers } from "@/whitbyos/lib/notify";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { NOTIFICATION_EVENTS } from "@/client-portal/types";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import {
  noAccessMessage,
  requireLiveContext,
  text,
  toastUrl,
  VIEW_ONLY,
} from "./guard";

const ONBOARDING = "/client-portal/onboarding";

/**
 * Onboarding writes are best-effort by design: a client who has just accepted an
 * invitation must never be trapped on a step because a save failed. Each step
 * advances regardless and the details remain editable under Profile & Settings
 * (SRS 4.1.3).
 */
export async function saveOnboardingProfile(formData: FormData) {
  const ctx = await requireLiveContext();

  if (ctx) {
    const fullName = text(formData, "fullName");
    const supabase = await createClient();
    const [first, ...rest] = (fullName ?? "").split(/\s+/).filter(Boolean);

    await supabase
      .from("users")
      .update({
        full_name: fullName,
        preferred_name: text(formData, "preferredName"),
        salutation: text(formData, "salutation"),
        phone: text(formData, "phone"),
        timezone: text(formData, "timezone") ?? "UTC",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.userId!);

    await supabase
      .from("contacts")
      .update({
        ...(first ? { first_name: first } : {}),
        ...(rest.length > 0 ? { last_name: rest.join(" ") } : {}),
        preferred_name: text(formData, "preferredName"),
        salutation: text(formData, "salutation"),
        phone: text(formData, "phone"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.contactId);
  }

  redirect(`${ONBOARDING}/preferences`);
}

export async function saveOnboardingPreferences(formData: FormData) {
  const ctx = await requireLiveContext();

  if (ctx) {
    const supabase = await createClient();

    await supabase.from("client_portal_notification_prefs").upsert(
      NOTIFICATION_EVENTS.map((event) => ({
        contact_id: ctx.contactId,
        event_type: event,
        channel: "email",
        enabled: formData.get(`event:${event}`) === "on",
      })),
      { onConflict: "contact_id,event_type,channel" },
    );

    const { data: existing } = await supabase
      .from("contacts")
      .select("enrichment_data")
      .eq("id", ctx.contactId)
      .maybeSingle();

    await supabase
      .from("contacts")
      .update({
        enrichment_data: {
          ...((existing?.enrichment_data as Record<string, unknown>) ?? {}),
          portal_preferences: {
            preferred_channel: text(formData, "preferredChannel"),
            update_frequency: text(formData, "updateFrequency"),
            language: text(formData, "language"),
            accessibility: text(formData, "accessibility"),
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.contactId);
  }

  redirect(`${ONBOARDING}/people`);
}

/** Step 3 is optional — most clients finish onboarding without adding anyone. */
export async function finishPeopleStep(formData: FormData) {
  const requested = formData.get("requestedCount");
  const count = typeof requested === "string" ? Number(requested) : 0;
  redirect(count > 0 ? `${ONBOARDING}/review` : `${ONBOARDING}/welcome`);
}

/**
 * The same ask as `requestAccess`, from the onboarding step instead of the
 * settings screen — so it needs the same two refusals.
 *
 * Onboarding is written for the primary member, who holds every area and hits
 * neither of these. But nothing stops another member typing the step's address,
 * and the guard on `requestAccess` would then be a guard on one of the two doors
 * into the same table. Best-effort is the rule for a client's *own* details in
 * this file; who is on the account is not one of those.
 */
export async function requestAccessDuringOnboarding(formData: FormData) {
  const personName = text(formData, "personName");
  const personEmail = text(formData, "personEmail");
  const step = `${ONBOARDING}/people`;

  if (!personName || !personEmail) {
    redirect(toastUrl(`${step}?add=1`, "A name and email are required."));
  }

  const context = await getPortalContext();
  if (!context.areas.people) {
    redirect(toastUrl(step, noAccessMessage("people")));
  }
  if (context.viewOnly) {
    redirect(toastUrl(step, VIEW_ONLY));
  }

  const ctx = await requireLiveContext();
  if (ctx) {
    const supabase = await createClient();
    const relationship = text(formData, "relationship");

    await supabase.from("client_portal_access_requests").insert({
      client_id: ctx.clientId,
      requested_by_contact_id: ctx.contactId,
      person_name: personName,
      person_email: personEmail,
      relationship,
      requested_role: text(formData, "requestedRole"),
      reason: text(formData, "reason"),
      status: "pending",
    });

    // The same notice the settings screen's version raises: a request made on
    // the way in is not a quieter request.
    if (ctx.workspaceId && ctx.clientId) {
      await notifyWorkspaceMembers({
        workspaceId: ctx.workspaceId,
        event: IN_APP.accessRequest,
        title: `${ctx.accountName}: access asked for ${personName}`,
        body: `${ctx.displayName} asked for ${personName}${
          relationship ? ` (${relationship})` : ""
        } to be given access. Review the level before approving.`,
        href: `/whitbyos/clients/${ctx.clientId}/contacts`,
        entityType: "client_portal_access_request",
        entityId: ctx.clientId,
      });
    }
  }

  redirect(toastUrl(step, `Access request for ${personName} submitted for review.`));
}
