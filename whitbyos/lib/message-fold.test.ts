import assert from "node:assert/strict";
import { test } from "node:test";
import { fold, onRequest, requestsOf } from "./message-fold.ts";
import type { ThreadRow } from "./messages.ts";

/**
 * One person, one conversation.
 *
 * The inbox used to show a row per thread, and a thread was the person *and*
 * the Request — so writing to Rohail about a second piece of work gave you a
 * second Rohail. Every case here is that complaint: what the rail shows, what
 * it says was last said, and what has to stay reachable inside.
 */
const person = {
  id: "rohail",
  participantType: "contact" as const,
  name: "Rohail",
  kind: "contact" as const,
  photo: null,
};

const hazel = { ...person, id: "hazel", name: "Hazel Summers" };

function row(over: Partial<ThreadRow> & { id: string }): ThreadRow {
  return {
    subject: "Rohail",
    kind: "direct",
    counterparty: "Rohail",
    preview: "",
    lastAt: null,
    unread: false,
    lastMine: false,
    lastRead: false,
    draft: false,
    requestId: null,
    requestTitle: null,
    clientId: null,
    clientName: null,
    participantCount: 2,
    people: [person],
    counterpartyPhoto: null,
    photo: null,
    archived: false,
    empty: false,
    unreadCount: 0,
    openAt: over.id,
    mergedIds: [over.id],
    children: [],
    ...over,
  };
}

test("three conversations with one person become one", () => {
  const folded = fold([
    row({ id: "general", preview: "sir", lastAt: "2026-09-21T13:30:00Z" }),
    row({
      id: "relocation",
      requestId: "r1",
      requestTitle: "relocation testing",
      preview: "What we need from you",
      lastAt: "2026-09-20T09:00:00Z",
    }),
    row({ id: "older", preview: "hi", lastAt: "2026-09-16T08:00:00Z" }),
  ]);

  assert.equal(folded.length, 1);
  const [chat] = folded;

  // The conversation is the talk filed under nothing, and both threads of it.
  assert.equal(chat.id, "general");
  assert.deepEqual(chat.mergedIds.sort(), ["general", "older"]);
  // The Request keeps its own thread, inside.
  assert.deepEqual(
    chat.children.map((child) => child.id),
    ["relocation"],
  );
});

test("the row says what was last said, wherever it was said", () => {
  const [chat] = fold([
    row({ id: "general", preview: "sir", lastAt: "2026-09-18T13:30:00Z" }),
    row({
      id: "relocation",
      requestId: "r1",
      requestTitle: "relocation testing",
      preview: "We have started on Dallas",
      lastAt: "2026-09-21T09:00:00Z",
      lastMine: true,
    }),
  ]);

  assert.equal(chat.preview, "We have started on Dallas");
  assert.equal(chat.lastAt, "2026-09-21T09:00:00Z");
  assert.equal(chat.lastMine, true);
});

test("unread anywhere inside is unread on the row", () => {
  const [chat] = fold([
    row({ id: "general", lastAt: "2026-09-21T13:30:00Z" }),
    row({
      id: "relocation",
      requestId: "r1",
      requestTitle: "relocation testing",
      lastAt: "2026-09-20T09:00:00Z",
      unread: true,
    }),
  ]);

  assert.equal(chat.unread, true);
  assert.equal(onRequest(chat), true);
  assert.deepEqual(requestsOf(chat), [
    { id: "r1", title: "relocation testing", threadId: "relocation" },
  ]);
});

test("somebody only ever written to about work still has one conversation", () => {
  const [chat] = fold([
    row({
      id: "first",
      requestId: "r1",
      requestTitle: "Ontario permit",
      lastAt: "2026-09-14T10:00:00Z",
    }),
    row({
      id: "second",
      requestId: "r2",
      requestTitle: "Dallas Corporate",
      lastAt: "2026-09-20T10:00:00Z",
    }),
  ]);

  // The newest stands as the conversation; the other is a thread in it.
  assert.equal(chat.id, "second");
  assert.deepEqual(
    chat.children.map((child) => child.id),
    ["first"],
  );
  assert.deepEqual(
    requestsOf(chat).map((on) => on.id),
    ["r2", "r1"],
  );
});

test("archived stays in Archived rather than folding into a live chat", () => {
  const folded = fold([
    row({ id: "general", lastAt: "2026-09-21T13:30:00Z" }),
    row({ id: "put-away", archived: true, lastAt: "2026-09-10T13:30:00Z" }),
  ]);

  assert.equal(folded.length, 2);
  assert.deepEqual(
    folded.map((chat) => chat.archived),
    [false, true],
  );
});

test("different people, and a group, are left alone", () => {
  const folded = fold([
    row({ id: "rohail", lastAt: "2026-09-21T13:30:00Z" }),
    row({ id: "hazel", people: [hazel], lastAt: "2026-09-20T13:30:00Z" }),
    row({
      id: "group",
      kind: "group",
      people: [person, hazel],
      lastAt: "2026-09-19T13:30:00Z",
    }),
  ]);

  assert.deepEqual(
    folded.map((chat) => chat.id),
    ["rohail", "hazel", "group"],
  );
  assert.deepEqual(
    folded.map((chat) => chat.children.length),
    [0, 0, 0],
  );
});

test("a group folds on its name and the people in it", () => {
  const members = [person, hazel];

  const folded = fold([
    row({
      id: "work",
      kind: "group",
      subject: "Work Collaboration",
      counterparty: "Rohail, Hazel Summers",
      people: members,
      lastAt: "2026-09-21T13:30:00Z",
    }),
    row({
      id: "work-abc",
      kind: "group",
      subject: "Work Collaboration",
      counterparty: "Rohail, Hazel Summers",
      people: [hazel, person],
      requestId: "abc",
      requestTitle: "ABC",
      lastAt: "2026-09-20T13:30:00Z",
    }),
  ]);

  assert.equal(folded.length, 1);
  assert.equal(folded[0].id, "work");
  assert.deepEqual(
    folded[0].children.map((child) => child.id),
    ["work-abc"],
  );
});

test("removing someone does not split a group into two rows", () => {
  const five = [person, hazel, { ...person, id: "third", name: "Third" }];
  const four = [person, hazel];

  const folded = fold([
    row({
      id: "after-remove",
      kind: "group",
      subject: "Work Collaboration",
      people: four,
      participantCount: 4,
      counterparty: "Rohail, Hazel Summers",
      preview: "You removed Third",
      lastAt: "2026-09-22T13:30:00Z",
    }),
    row({
      id: "older-sibling",
      kind: "group",
      subject: "Work Collaboration",
      people: five,
      participantCount: 5,
      counterparty: "Rohail, Hazel Summers, Third",
      preview: ".",
      lastAt: "2026-09-20T13:30:00Z",
    }),
  ]);

  assert.equal(folded.length, 1);
  assert.equal(folded[0].participantCount, 4);
  assert.equal(folded[0].preview, "You removed Third");
});

test("two groups of the same people, named differently, stay two", () => {
  const members = [person, hazel];

  const folded = fold([
    row({ id: "work", kind: "group", subject: "Work Collaboration", people: members }),
    row({ id: "travel", kind: "group", subject: "Travel", people: members }),
  ]);

  assert.deepEqual(
    folded.map((chat) => chat.id).sort(),
    ["travel", "work"],
  );
});

test("an empty thread is not a conversation, alone", () => {
  const folded = fold([
    row({ id: "never-used", empty: true, lastAt: null }),
    row({ id: "hazel", people: [hazel], lastAt: "2026-09-20T13:30:00Z" }),
  ]);

  assert.deepEqual(
    folded.map((chat) => chat.id),
    ["hazel"],
  );
});

test("an empty General thread anchors the conversation it was asked for", () => {
  const [chat] = fold([
    row({
      id: "abc",
      requestId: "abc",
      requestTitle: "ABC",
      preview: "Test",
      lastAt: "2026-09-21T13:30:00Z",
    }),
    row({ id: "general", empty: true, preview: "No messages yet", lastAt: null }),
  ]);

  // Replies typed in the person's own chat land there, not on the Request.
  assert.equal(chat.id, "general");
  assert.deepEqual(chat.mergedIds, ["general"]);
  // And the row still says what was last said, which was said on the Request.
  assert.equal(chat.preview, "Test");
  assert.equal(chat.lastAt, "2026-09-21T13:30:00Z");
  assert.equal(chat.empty, false);
});

test("the row counts everything unread in it, and opens where it is", () => {
  const [chat] = fold([
    row({ id: "general", preview: "sir", lastAt: "2026-09-21T13:30:00Z" }),
    row({
      id: "permit",
      requestId: "r1",
      requestTitle: "Ontario permit",
      lastAt: "2026-09-22T09:00:00Z",
      unread: true,
      unreadCount: 6,
    }),
  ]);

  assert.equal(chat.unreadCount, 6);
  // Not General, which has nothing new in it.
  assert.equal(chat.openAt, "permit");
});

test("unread in the conversation itself opens the conversation", () => {
  const [chat] = fold([
    row({
      id: "general",
      lastAt: "2026-09-22T13:30:00Z",
      unread: true,
      unreadCount: 2,
    }),
    row({
      id: "permit",
      requestId: "r1",
      requestTitle: "Ontario permit",
      lastAt: "2026-09-20T09:00:00Z",
    }),
  ]);

  assert.equal(chat.openAt, "general");
  assert.equal(chat.unreadCount, 2);
});

test("a draft left in one thread is what the row shows", () => {
  const [chat] = fold([
    row({
      id: "general",
      draft: true,
      preview: "nmncnmxncn",
      lastAt: "2026-09-20T10:00:00Z",
    }),
    row({
      id: "abc",
      requestId: "r1",
      requestTitle: "ABC",
      preview: "Site visit, Friday 25 September",
      lastAt: "2026-09-22T10:00:00Z",
    }),
  ]);

  // Not the newer Request thread: an unsent message is the thing you left in
  // the middle, and the list is where you are reminded of it.
  assert.equal(chat.draft, true);
  assert.equal(chat.preview, "nmncnmxncn");
});

test("a draft in a Request thread opens that thread", () => {
  const [chat] = fold([
    row({ id: "general", preview: "hi", lastAt: "2026-09-22T10:00:00Z" }),
    row({
      id: "abc",
      requestId: "r1",
      requestTitle: "ABC",
      draft: true,
      preview: "half a sen",
      lastAt: "2026-09-20T10:00:00Z",
    }),
  ]);

  assert.equal(chat.draft, true);
  assert.equal(chat.openAt, "abc");
});
