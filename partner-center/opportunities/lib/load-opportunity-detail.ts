import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { ENTERPRISE_PAYMENT_QUALIFYING_ACTION } from "@/partner-center/lib/attribution/opportunity-payment-eligibility";
import {
  isOpportunityEditable,
  protectionDaysLabel,
} from "@/partner-center/opportunities/lib/can-mutate";
import { formatShortDate } from "@/partner-center/opportunities/lib/format";
import { unpackOpportunityNotes } from "@/partner-center/opportunities/lib/notes";
import { loadProductInterestOptions } from "@/partner-center/opportunities/lib/product-interest-options";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { qualifyingActionLabel } from "@/partner-center/referrals/lib/format";
import type {
  OpportunityDetail,
  OpportunityTimelineItem,
} from "@/partner-center/opportunities/types";
import type { PartnerContext } from "@/partner-center/types/partner";

function contactDisplayName(contact: {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string | null {
  const preferred = contact.preferred_name?.trim();
  if (preferred) return preferred;
  const composed = [contact.first_name, contact.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return composed || null;
}

function buildTimeline(input: {
  id: string;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  protectedUntil: string | null;
  attributionEvents: {
    id: string;
    qualifying_action: string;
    event_timestamp: string;
    amount_collected_cents: number | null;
  }[];
}): OpportunityTimelineItem[] {
  const items: OpportunityTimelineItem[] = [];

  if (input.status === "converted") {
    const convertEvent = input.attributionEvents.find((event) =>
      /convert|won|paid|purchase|order/i.test(event.qualifying_action),
    );
    const at = convertEvent?.event_timestamp || input.acceptedAt || input.createdAt;
    items.push({
      id: `converted-${input.id}`,
      at,
      dateLabel: formatShortDate(at),
      parts: [
        { text: "Status updated to " },
        { text: "Converted", bold: true },
        { text: convertEvent ? ` — ${qualifyingActionLabel(convertEvent.qualifying_action)}` : "." },
      ],
    });
  }

  if (input.status === "not_moving_forward") {
    items.push({
      id: `closed-${input.id}`,
      at: input.acceptedAt || input.createdAt,
      dateLabel: formatShortDate(input.acceptedAt || input.createdAt),
      parts: [
        { text: "Status updated to " },
        { text: "Closed", bold: true },
        { text: " — not moving forward." },
      ],
    });
  }

  if (input.status === "in_progress" || input.status === "converted") {
    const progressEvent = input.attributionEvents.find((event) =>
      /progress|evaluation|underway|started/i.test(event.qualifying_action),
    );
    if (progressEvent) {
      items.push({
        id: `progress-${progressEvent.id}`,
        at: progressEvent.event_timestamp,
        dateLabel: formatShortDate(progressEvent.event_timestamp),
        parts: [
          { text: "Status updated to " },
          { text: "In Progress", bold: true },
          { text: ` — ${qualifyingActionLabel(progressEvent.qualifying_action)}` },
        ],
      });
    } else if (input.status === "in_progress") {
      const at = input.acceptedAt || input.createdAt;
      items.push({
        id: `progress-${input.id}`,
        at,
        dateLabel: formatShortDate(at),
        parts: [
          { text: "Status updated to " },
          { text: "In Progress", bold: true },
          { text: "." },
        ],
      });
    }
  }

  if (input.acceptedAt) {
    items.push({
      id: `accepted-${input.id}`,
      at: input.acceptedAt,
      dateLabel: formatShortDate(input.acceptedAt),
      parts: [
        { text: "Accepted", bold: true },
        {
          text: input.protectedUntil
            ? ` — ${protectionDaysLabel(input.acceptedAt, input.protectedUntil)} assigned`
            : ".",
        },
      ],
    });
  }

  for (const event of input.attributionEvents) {
    if (event.qualifying_action === ENTERPRISE_PAYMENT_QUALIFYING_ACTION) {
      const amountUsd =
        event.amount_collected_cents != null
          ? (event.amount_collected_cents / 100).toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })
          : null;
      items.push({
        id: `payment-${event.id}`,
        at: event.event_timestamp,
        dateLabel: formatShortDate(event.event_timestamp),
        parts: [
          { text: "Payment collected", bold: true },
          { text: amountUsd ? ` — ${amountUsd}` : "." },
        ],
      });
      continue;
    }

    if (
      /progress|evaluation|underway|started|convert|won|paid|purchase|order/i.test(
        event.qualifying_action,
      )
    ) {
      continue;
    }
    items.push({
      id: `attr-${event.id}`,
      at: event.event_timestamp,
      dateLabel: formatShortDate(event.event_timestamp),
      parts: [{ text: qualifyingActionLabel(event.qualifying_action) }],
    });
  }

  items.push({
    id: `submitted-${input.id}`,
    at: input.createdAt,
    dateLabel: formatShortDate(input.createdAt),
    parts: [{ text: "Opportunity submitted" }],
  });

  items.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return items;
}

export async function loadOpportunityDetail(
  context: PartnerContext | null,
  opportunityId: string,
): Promise<OpportunityDetail | null> {
  const profile = context?.profile;
  if (!profile || !isSupabaseConfigured() || !opportunityId) return null;

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("partner_opportunities")
    .select(
      "id, company_id, primary_contact_id, product_interest, estimated_seats, estimated_value, status, accepted_at, protected_until, notes, attachment_document_id, permission_to_contact, created_at",
    )
    .eq("partner_profile_id", profile.id)
    .eq("id", opportunityId)
    .maybeSingle();

  if (error || !row) return null;

  const companyId = row.company_id as string;
  const contactId = row.primary_contact_id as string;
  const attachmentId =
    (row.attachment_document_id as string | null) ?? null;

  const [companyRes, contactRes, eventsRes, attachmentRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, website")
      .eq("id", companyId)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, preferred_name, title_role, email, phone",
      )
      .eq("id", contactId)
      .maybeSingle(),
    supabase
      .from("partner_attribution_events")
      .select(
        "id, qualifying_action, event_timestamp, amount_collected_cents, created_at",
      )
      .eq("partner_profile_id", profile.id)
      .eq("opportunity_id", opportunityId)
      .order("event_timestamp", { ascending: false }),
    attachmentId
      ? (async () => {
          const reader = createAdminClient() ?? supabase;
          return reader
            .from("documents")
            .select("id, title")
            .eq("id", attachmentId)
            .maybeSingle();
        })()
      : Promise.resolve({ data: null }),
  ]);

  const companyName =
    (companyRes.data?.name as string | null)?.trim() || "Opportunity";
  const website =
    (companyRes.data?.website as string | null)?.trim() || null;
  const contactName = contactRes.data
    ? contactDisplayName({
        preferred_name: contactRes.data.preferred_name as string | null,
        first_name: contactRes.data.first_name as string | null,
        last_name: contactRes.data.last_name as string | null,
      })
    : null;
  const contactTitle =
    (contactRes.data?.title_role as string | null)?.trim() || null;
  const contactEmail =
    (contactRes.data?.email as string | null)?.trim() || null;
  const contactPhone =
    (contactRes.data?.phone as string | null)?.trim() || null;

  const { timing, context: additionalContext } = unpackOpportunityNotes(
    row.notes as string | null,
  );

  const valueRaw = row.estimated_value;
  const estimatedValueNum =
    valueRaw == null || valueRaw === "" ? null : Number(valueRaw);

  const createdAt = row.created_at as string;
  const acceptedAt = (row.accepted_at as string | null) ?? null;
  const protectedUntil = (row.protected_until as string | null) ?? null;
  const status = row.status as string;

  const events = (eventsRes.data ?? []).map((event) => ({
    id: event.id as string,
    qualifying_action: event.qualifying_action as string,
    event_timestamp:
      (event.event_timestamp as string) || (event.created_at as string),
    amount_collected_cents:
      (event.amount_collected_cents as number | null) ?? null,
  }));

  return {
    id: row.id as string,
    companyName,
    website,
    status,
    contactName,
    contactTitle,
    contactEmail,
    contactPhone,
    productInterest: (row.product_interest as string | null) ?? null,
    estimatedSeats:
      row.estimated_seats == null ? null : Number(row.estimated_seats),
    estimatedValue:
      estimatedValueNum != null && Number.isFinite(estimatedValueNum)
        ? estimatedValueNum
        : null,
    expectedTiming: timing,
    additionalContext,
    attachment: attachmentRes.data
      ? {
          id: attachmentRes.data.id as string,
          title:
            ((attachmentRes.data.title as string | null) ?? "").trim() ||
            "Attachment",
        }
      : null,
    permissionToContact: Boolean(row.permission_to_contact ?? true),
    submittedAt: createdAt,
    submittedLabel: formatShortDate(createdAt),
    acceptedAt,
    acceptedLabel: acceptedAt ? formatShortDate(acceptedAt) : null,
    protectedUntil,
    protectedUntilLabel: protectedUntil
      ? formatShortDate(protectedUntil)
      : null,
    editable: isOpportunityEditable(status),
    timeline: buildTimeline({
      id: row.id as string,
      status,
      createdAt,
      acceptedAt,
      protectedUntil,
      attributionEvents: events,
    }),
    productInterestOptions: (
      await loadProductInterestOptions(supabase, { activeOnly: false })
    ).map((option) => ({ value: option.value, label: option.label })),
  };
}
