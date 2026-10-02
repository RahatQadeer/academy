import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fallbackAnswer,
  fallbackLead,
  resolveAskScope,
  unansweredReason,
} from "./ask-scope.ts";

const clients = [
  { id: "r", name: "Rohail Khan" },
  { id: "w", name: "Whitfield Estate" },
];

test("a named client wins over the one that is open", () => {
  const scope = resolveAskScope({
    question: "Who is on Whitfield Estate?",
    clients,
    openClient: clients[0]!,
  });
  assert.equal(scope.kind, "client");
  if (scope.kind === "client") assert.equal(scope.client.id, "w");
});

test("his workplan is the client that is already open", () => {
  const scope = resolveAskScope({
    question: "what is next in his workplan",
    clients,
    openClient: clients[0]!,
  });
  assert.equal(scope.kind, "client");
  if (scope.kind === "client") assert.equal(scope.client.name, "Rohail Khan");
});

test("with nobody open, the question is about every client", () => {
  const scope = resolveAskScope({
    question: "what is overdue",
    clients,
    openClient: null,
  });
  assert.equal(scope.kind, "all");
  if (scope.kind === "all") assert.equal(scope.clients.length, 2);
});

test("the fallback names the next open task", () => {
  const lead = fallbackLead({
    scopeLabel: "Rohail Khan",
    plans: [
      {
        id: "p",
        name: "Family Relocation Plan",
        status: "active",
        health: "on_track",
        target: null,
        requestTitle: "ABC",
        clientName: "Rohail Khan",
        done: 1,
        total: 18,
        next: null,
      },
    ],
    tasks: [
      {
        id: "t",
        title: "Get Chidi's degree certificate attested for the UAE",
        status: "not_started",
        due: new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10),
        nextAction: "Book the attestation slot",
        planId: "p",
        planName: "Family Relocation Plan",
        requestTitle: "ABC",
        clientId: "r",
        clientName: "Rohail Khan",
        href: "/whitbyos/work-plans/p/tasks/t",
      },
    ],
    requests: [{ id: "q", title: "ABC", status: "open", clientName: "Rohail Khan" }],
  });

  assert.match(lead, /Rohail Khan/);
  assert.match(lead, /degree certificate/);
  assert.match(lead, /Family Relocation Plan/);
  assert.match(lead, /overdue/);
});

/**
 * A failure must not read like an answer.
 *
 * Every failure of the model call used to return `fallbackAnswer(brief)`
 * unchanged, which opens "For Rohail Khan, the next work is X, three days
 * overdue." Asked whether a passport had come back, during an outage, that
 * is fluent, on topic, confidently wrong, and looks exactly like a reply.
 */
test("a stood-in answer says it is not an answer", () => {
  const brief = {
    scopeLabel: "Rohail Khan",
    plans: [],
    tasks: [
      {
        id: "t1",
        title: "Book the school tour",
        status: "not_started",
        due: "2026-09-01",
        planName: "Move to Richmond",
        nextAction: null,
      },
    ],
    requests: [],
  };

  const real = fallbackAnswer(brief);
  assert.ok(real.lead.includes("the next work is"));

  const stood = fallbackAnswer(brief, "the model took too long to answer");
  assert.ok(stood.lead.startsWith("I could not answer that"));
  assert.ok(stood.lead.includes("the model took too long to answer"));
  assert.ok(stood.lead.includes("Nothing here is an answer"));
  /* The rows stay: they are real, and they are why this is worth drawing. */
  assert.ok(stood.sections.length > 0);
});

test("every provider failure gets a sentence somebody can act on", () => {
  assert.equal(
    unansweredReason("No model is configured for this workspace."),
    "no AI model is set up for this workspace",
  );
  assert.equal(unansweredReason("The model took too long to respond."), "the model took too long to answer");
  assert.equal(unansweredReason("Model request failed (429)."), "the model is rate limiting us at the moment");
  assert.equal(unansweredReason("Could not reach the model."), "the model could not be reached");
  /* Anything unrecognised still says something true rather than a code. */
  assert.equal(unansweredReason("ECONNRESET"), "the model did not answer");
  assert.equal(unansweredReason(null), "the model did not answer");
});
