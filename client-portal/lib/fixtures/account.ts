import type {
  AccessRequest,
  AreaAccess,
  BillingSummary,
  NotificationPref,
  PortalArea,
  PortalIntegration,
  PortalInvoice,
  PortalPerson,
} from "@/client-portal/types";
import { NOTIFICATION_EVENTS } from "@/client-portal/types";
import type { ChosenSource, SourceKind } from "@/client-portal/lib/integrations/catalog";
import type { EmailPerson, SourcePicker } from "@/client-portal/lib/integrations/mail";
import { daysAgo, daysAhead, hoursAgo } from "./clock";

export const BILLING_SUMMARY: BillingSummary = {
  outstandingCents: 1_842_500,
  paidThisYearCents: 7_460_000,
  nextDueAt: daysAhead(9, 12),
  currency: "USD",
};

export const INVOICES: PortalInvoice[] = [
  {
    id: "inv-1042",
    number: "INV-1042",
    description: "Coordination retainer, current period",
    amountCents: 1_250_000,
    status: "due",
    issuedAt: daysAgo(6),
    dueAt: daysAhead(9, 12),
    paidAt: null,
    requestTitle: null,
  },
  {
    id: "inv-1039",
    number: "INV-1039",
    description: "Household staffing search, placement stage",
    amountCents: 592_500,
    status: "overdue",
    issuedAt: daysAgo(38),
    dueAt: daysAgo(8),
    paidAt: null,
    requestTitle: "Household Staffing Search",
  },
  {
    id: "inv-1031",
    number: "INV-1031",
    description: "Coordination retainer, prior period",
    amountCents: 1_250_000,
    status: "paid",
    issuedAt: daysAgo(66),
    dueAt: daysAgo(36),
    paidAt: daysAgo(40),
    requestTitle: null,
  },
  {
    id: "inv-1024",
    number: "INV-1024",
    description: "Estate document renewal, counsel coordination",
    amountCents: 380_000,
    status: "paid",
    issuedAt: daysAgo(96),
    dueAt: daysAgo(66),
    paidAt: daysAgo(70),
    requestTitle: "Estate Document Renewal",
  },
];

export const INTEGRATIONS: PortalIntegration[] = [
  {
    key: "google_calendar",
    name: "Google Calendar",
    group: "Calendar",
    purpose: "Show your own events beside the ones your team schedules with you",
    status: "needs_attention",
    connectedAccount: "michael.chen@hartwellfo.com",
    lastSyncAt: daysAgo(3),
    errorState: "Google Calendar needs you to connect it again.",
    syncSettings: {},
    connectable: true,
  },
  {
    key: "outlook_calendar",
    name: "Outlook Calendar",
    group: "Calendar",
    purpose: "Connect your Microsoft calendar to your account",
    status: "disconnected",
    connectedAccount: null,
    lastSyncAt: null,
    errorState: null,
    syncSettings: {},
    connectable: false,
  },
  {
    key: "gmail",
    name: "Gmail",
    group: "Email",
    purpose: "Keep a summary of the email you exchange with the people you choose",
    status: "connected",
    connectedAccount: "michael.chen@hartwellfo.com",
    lastSyncAt: hoursAgo(1),
    errorState: null,
    syncSettings: {},
    connectable: true,
  },
  {
    key: "outlook_mail",
    name: "Outlook Mail",
    group: "Email",
    purpose: "Connect your Microsoft mailbox to your account",
    status: "disconnected",
    connectedAccount: null,
    lastSyncAt: null,
    errorState: null,
    syncSettings: {},
    connectable: false,
  },
];

/** The sample person's Gmail Manage: two people chosen, one more on offer. */
export const GMAIL_MANAGE: { picker: SourcePicker; chosen: ChosenSource[] } = {
  picker: {
    team: [
      { kind: "team", id: "user-jordan", name: "Jordan Hartwell", email: null },
      { kind: "team", id: "user-priya", name: "Priya Raman", email: null },
    ],
    people: [
      { kind: "person", id: "contact-alex", name: "Alexandra Chen", email: "alexandra.chen@example.com" },
    ],
  },
  chosen: [
    { kind: "team", sourceId: "user-jordan", label: "Jordan Hartwell", email: null },
    { kind: "external", sourceId: null, label: "office@mallorcavillas.es", email: "office@mallorcavillas.es" },
  ],
};

/** What the sample Gmail has read, as the Gmail page files it. */
export const EMAIL: {
  people: { id: string; label: string; kind: SourceKind }[];
  sections: EmailPerson[];
} = {
  people: [
    { id: "src-jordan", label: "Jordan Hartwell", kind: "team" },
    { id: "src-villas", label: "office@mallorcavillas.es", kind: "external" },
  ],
  sections: [
    {
      sourceId: "src-jordan",
      kind: "team",
      name: "Jordan Hartwell",
      rows: [
        {
          id: "em-1",
          direction: "incoming",
          subject: "Final interviews next week",
          summary: "Jordan scheduled final interviews with two household staff candidates.",
          facts: ["Interviews on Tuesday and Thursday at 10:00", "Profiles are in Documents"],
          at: hoursAgo(3),
        },
        {
          id: "em-2",
          direction: "outgoing",
          subject: "Re: Weekend availability",
          summary: "You confirmed weekend availability matters more than live-in.",
          facts: [],
          at: daysAgo(4),
        },
      ],
    },
    {
      sourceId: "src-villas",
      kind: "external",
      name: "office@mallorcavillas.es",
      rows: [
        {
          id: "em-3",
          direction: "incoming",
          subject: "Hold on Villa Serena",
          summary: "The agency is holding Villa Serena for your dates until Friday.",
          facts: ["Hold expires Friday at 18:00", "Deposit of €4,500 to confirm"],
          at: daysAgo(1),
        },
      ],
    },
  ],
};

/**
 * Areas for a sample person, written the way `readAreas` returns them: name the
 * ones granted and the rest are false. `scopeSummary` beside each is what
 * `areaSummary` would produce for the same set, so the sample account reads
 * exactly like a live one.
 */
function sampleAreas(...granted: PortalArea[]): AreaAccess {
  return Object.fromEntries(
    (["requests", "messages", "calendar", "documents", "forms", "updates", "billing"] as const).map(
      (key) => [key, granted.includes(key)],
    ),
  ) as AreaAccess;
}

const EVERY_AREA = sampleAreas(
  "requests",
  "messages",
  "calendar",
  "documents",
  "forms",
  "updates",
  "billing",
);

export const PEOPLE: PortalPerson[] = [
  {
    id: "person-michael",
    contactId: "contact-michael",
    name: "Michael Chen",
    email: "michael.chen@hartwellfo.com",
    role: "primary_member",
    relationship: "Principal",
    // The sample account has no bucket behind it, so nobody in it has a face.
    photoUrl: null,
    portalAccess: true,
    status: "active",
    scopeSummary: "Full account access",
    areas: EVERY_AREA,
    viewOnly: false,
    areasInherited: false,
  },
  {
    id: "person-sarah",
    contactId: "contact-sarah",
    name: "Sarah Chen",
    email: "sarah.chen@hartwellfo.com",
    role: "additional_member",
    relationship: "Spouse",
    // The sample account has no bucket behind it, so nobody in it has a face.
    photoUrl: null,
    portalAccess: true,
    status: "active",
    scopeSummary:
      "Requests, Messages, Calendar, Documents, Forms and Updates",
    areas: sampleAreas(
      "requests",
      "messages",
      "calendar",
      "documents",
      "forms",
      "updates",
    ),
    viewOnly: false,
    areasInherited: false,
  },
  {
    id: "person-priya",
    contactId: "contact-priya",
    name: "Priya Raman",
    email: "priya@hartwellfo.com",
    role: "authorized_user",
    relationship: "Executive Assistant",
    // The sample account has no bucket behind it, so nobody in it has a face.
    photoUrl: null,
    portalAccess: true,
    status: "active",
    scopeSummary: "Requests, Messages and Calendar",
    areas: sampleAreas("requests", "messages", "calendar"),
    viewOnly: false,
    areasInherited: false,
  },
  {
    id: "person-noah",
    contactId: "contact-noah",
    name: "Noah Chen",
    email: null,
    role: "dependent",
    relationship: "Son",
    // The sample account has no bucket behind it, so nobody in it has a face.
    photoUrl: null,
    portalAccess: false,
    status: "active",
    scopeSummary: "Related record, no portal login",
    areas: sampleAreas(),
    viewOnly: true,
    areasInherited: false,
  },
];

export const ACCESS_REQUESTS: AccessRequest[] = [
  {
    id: "areq-1",
    personName: "Daniel Okoro",
    personEmail: "daniel.okoro@okorocpa.com",
    relationship: "Accountant",
    requestedRole: "Billing Contact",
    requestedAreas: ["documents", "billing"],
    reason: "Handles invoice review and payment approvals for the household.",
    status: "pending",
    createdAt: daysAgo(2),
    reviewedAt: null,
  },
];

export const NOTIFICATION_PREFS: NotificationPref[] = NOTIFICATION_EVENTS.map(
  (event) => ({
    event,
    channel: "email" as const,
    enabled: event !== "calendar_change",
  }),
);
