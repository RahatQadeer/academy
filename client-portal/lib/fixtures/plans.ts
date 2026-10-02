import type { PortalPlan, PortalRequestDetail } from "@/client-portal/types";
import { daysAgo, daysAhead } from "./clock";

// Fixture timestamps are relative to load time so the demo account never looks
// stale. Real query paths never import this.

/** yyyy-mm-dd, the shape a `date` column comes back in. */
const day = (iso: string) => iso.slice(0, 10);

/**
 * One shared Work Plan, on the travel request, shaped the way
 * `portal_request_plans()` (client-portal/014) returns one: every task in each
 * visible stream, its owner's name, and nothing about priority, checklists or
 * dependencies. Enough dates, owners and states for all six views to have
 * something true to draw.
 *
 * `task-passport` is the same row TASKS lists as client-visible — a task can be
 * both, and the Request's Tasks tab must not count it twice.
 */
export const PLANS: PortalPlan[] = [
  {
    id: "plan-mallorca",
    requestId: "req-travel",
    name: "Mallorca Summer Stay",
    desiredOutcome:
      "The family arrives to a staffed villa with documents, flights and transfers settled.",
    status: "active",
    urgency: "high",
    health: "needs_attention",
    startDate: day(daysAgo(21)),
    targetDate: day(daysAhead(9)),
    createdAt: daysAgo(21),
    updatedAt: daysAgo(1),
    sharedAt: daysAgo(12),
    ownerName: "Jordan Hartwell",
    streams: [
      {
        id: "stream-villa",
        name: "Villa & Household Staff",
        purpose: "Secure the villa for three weeks and a chef and housekeeper for the stay.",
        status: "active",
        kind: "manual",
        blocked: false,
        targetDate: day(daysAhead(5)),
        createdAt: daysAgo(21),
        ownerName: "Jordan Hartwell",
        tasks: [
          {
            id: "task-villa-shortlist",
            title: "Shortlist villas in the Deià valley",
            status: "complete",
            kind: "manual",
            dueAt: daysAgo(14),
            completedAt: daysAgo(13),
            createdAt: daysAgo(20),
            waiting: false,
            ownerName: "Jordan Hartwell",
          },
          {
            id: "task-villa-choice",
            title: "Choose between the two shortlisted villas",
            status: "complete",
            kind: "approval",
            dueAt: daysAgo(4),
            completedAt: daysAgo(3),
            createdAt: daysAgo(13),
            waiting: false,
            ownerName: "Jordan Hartwell",
          },
          {
            id: "task-villa-dates",
            title: "Confirm villa dates",
            status: "in_progress",
            kind: "manual",
            dueAt: daysAhead(2, 17),
            completedAt: null,
            createdAt: daysAgo(3),
            waiting: false,
            ownerName: "Jordan Hartwell",
          },
          {
            id: "task-villa-chef",
            title: "Interview chef candidates",
            status: "not_started",
            kind: "manual",
            dueAt: daysAhead(6),
            completedAt: null,
            createdAt: daysAgo(3),
            waiting: false,
            ownerName: "Alicia Moreau",
          },
        ],
      },
      {
        id: "stream-documents",
        name: "Travel Documents",
        purpose: "Every traveller's passport valid for six months past the return date.",
        status: "waiting",
        kind: "manual",
        blocked: false,
        targetDate: day(daysAhead(4)),
        createdAt: daysAgo(20),
        ownerName: "Alicia Moreau",
        tasks: [
          {
            id: "task-insurance-certs",
            title: "Collect travel insurance certificates",
            status: "complete",
            kind: "manual",
            dueAt: daysAgo(5),
            completedAt: daysAgo(6),
            createdAt: daysAgo(18),
            waiting: false,
            ownerName: "Alicia Moreau",
          },
          {
            id: "task-passport",
            title: "Confirm passport expiry dates for the Mallorca trip",
            status: "waiting",
            kind: "manual",
            dueAt: daysAhead(3, 17),
            completedAt: null,
            createdAt: daysAgo(12),
            waiting: true,
            ownerName: "Alicia Moreau",
          },
          {
            id: "task-passport-renewal",
            title: "Renew Emma's passport",
            status: "in_progress",
            kind: "manual",
            dueAt: daysAgo(1),
            completedAt: null,
            createdAt: daysAgo(10),
            waiting: false,
            ownerName: "Alicia Moreau",
          },
        ],
      },
      {
        id: "stream-transfers",
        name: "Flights & Transfers",
        purpose: "Private flight to Palma and car transfers on both ends.",
        status: "not_started",
        kind: "manual",
        blocked: false,
        targetDate: day(daysAhead(9)),
        createdAt: daysAgo(20),
        ownerName: "Jordan Hartwell",
        tasks: [
          {
            id: "task-flight-hold",
            title: "Hold private flight to Palma",
            status: "not_started",
            kind: "approval",
            dueAt: daysAhead(7),
            completedAt: null,
            createdAt: daysAgo(2),
            waiting: false,
            ownerName: "Jordan Hartwell",
          },
          {
            id: "task-car-transfers",
            title: "Book car transfers on arrival and departure",
            status: "not_started",
            kind: "manual",
            dueAt: daysAhead(8),
            completedAt: null,
            createdAt: daysAgo(2),
            waiting: false,
            ownerName: null,
          },
        ],
      },
    ],
  },
];

/**
 * What `portal_request_detail()` returns for the demo requests — the people
 * on each, the notes shared with the client, and who owns the client-visible
 * tasks in TASKS.
 */
export const REQUEST_EXTRAS: Record<string, PortalRequestDetail> = {
  "req-travel": {
    createdAt: daysAgo(30),
    ownerName: "Jordan Hartwell",
    team: [
      { name: "Jordan Hartwell", role: "Owner" },
      { name: "Alicia Moreau", role: "Assisting" },
      { name: "Michael Chen", role: "Requestor" },
    ],
    notes: [
      {
        id: "note-villa-deadline",
        body: "The villa owners have asked for final dates by Friday so they can release the second week to other guests.",
        authorName: "Jordan Hartwell",
        createdAt: daysAgo(2),
      },
    ],
    taskOwners: { "task-passport": "Alicia Moreau" },
  },
  "req-staffing": {
    createdAt: daysAgo(45),
    ownerName: "Jordan Hartwell",
    team: [{ name: "Jordan Hartwell", role: "Owner" }],
    notes: [],
    taskOwners: { "task-references": "Jordan Hartwell" },
  },
};
