import assert from "node:assert/strict";
import { test } from "node:test";
import { deliveryLabel, seenAgo } from "./message-status.ts";

/**
 * The line under the last message you sent, which is the only place this is
 * drawn. Every case here is a boundary — the point the wording or the unit
 * changes — because "Seen 1h ago" when it was fifty minutes is a worse answer
 * than no time at all.
 */
const NOW = Date.parse("2026-09-16T12:00:00Z");
const ago = (minutes: number) => NOW - minutes * 60_000;

test("a message still in flight says so", () => {
  assert.equal(
    deliveryLabel({ pending: true, at: "2026-09-16T11:59:00Z", deliveredAt: null, readAt: null }, NOW),
    "Sending…",
  );
});

test("sent, then delivered, then seen", () => {
  const at = "2026-09-16T11:00:00Z";

  assert.equal(deliveryLabel({ at, deliveredAt: null, readAt: null }, NOW), "Sent");
  assert.equal(
    deliveryLabel({ at, deliveredAt: "2026-09-16T11:00:02Z", readAt: null }, NOW),
    "Delivered",
  );
  assert.equal(
    deliveryLabel({ at, deliveredAt: null, readAt: "2026-09-16T11:30:00Z" }, NOW),
    "Seen 30m ago",
  );
});

test("opening the thread before you wrote is not having seen it", () => {
  assert.equal(
    deliveryLabel(
      { at: "2026-09-16T11:00:00Z", deliveredAt: null, readAt: "2026-09-16T10:00:00Z" },
      NOW,
    ),
    "Sent",
  );
});

test("seen at the very moment it was sent still counts", () => {
  const same = "2026-09-16T11:00:00Z";
  assert.equal(deliveryLabel({ at: same, deliveredAt: null, readAt: same }, NOW), "Seen 1h ago");
});

test("how long ago, in the unit that answers the question", () => {
  assert.equal(seenAgo(ago(0), NOW), "just now");
  assert.equal(seenAgo(ago(0.9), NOW), "just now");
  assert.equal(seenAgo(ago(1), NOW), "1m ago");
  assert.equal(seenAgo(ago(59), NOW), "59m ago");
  assert.equal(seenAgo(ago(60), NOW), "1h ago");
  assert.equal(seenAgo(ago(23 * 60), NOW), "23h ago");
  assert.equal(seenAgo(ago(24 * 60), NOW), "yesterday");
  assert.equal(seenAgo(ago(47 * 60), NOW), "yesterday");
  assert.equal(seenAgo(ago(48 * 60), NOW), "2d ago");
  assert.equal(seenAgo(ago(6 * 24 * 60), NOW), "6d ago");
});

test("past a week it is a date, not a count", () => {
  assert.equal(seenAgo(ago(7 * 24 * 60), NOW), "9 Sep");
  assert.equal(seenAgo(Date.parse("2026-08-02T09:00:00Z"), NOW), "2 Aug");
});

test("a clock running ahead of ours is not the future", () => {
  assert.equal(seenAgo(NOW + 30_000, NOW), "just now");
});

/**
 * A group, where "Seen" alone says one of four people looked — which is the
 * question rather than the answer.
 */
const SENT = "2026-09-16T11:00:00Z";
const AFTER = "2026-09-16T11:30:00Z";
const BEFORE = "2026-09-16T10:00:00Z";

test("nobody on a group has opened it since", () => {
  assert.equal(
    deliveryLabel(
      {
        at: SENT,
        deliveredAt: null,
        readAt: null,
        readers: [
          { name: "Hazel Summers", readAt: BEFORE },
          { name: "Rohail Khan", readAt: null },
        ],
      },
      NOW,
    ),
    "Sent",
  );
});

test("one of them has, and is named", () => {
  assert.equal(
    deliveryLabel(
      {
        at: SENT,
        deliveredAt: null,
        readAt: null,
        readers: [
          { name: "Hazel Summers", readAt: AFTER },
          { name: "Rohail Khan", readAt: null },
        ],
      },
      NOW,
    ),
    "Seen by Hazel",
  );
});

test("two are named, and the rest are counted", () => {
  const readers = [
    { name: "Hazel Summers", readAt: AFTER },
    { name: "Rohail Khan", readAt: AFTER },
    { name: "Laiba Ajmal", readAt: AFTER },
    { name: "Tester One", readAt: null },
  ];

  assert.equal(
    deliveryLabel({ at: SENT, deliveredAt: null, readAt: null, readers }, NOW),
    "Seen by Hazel, Rohail and 1 other",
  );

  assert.equal(
    deliveryLabel(
      {
        at: SENT,
        deliveredAt: null,
        readAt: null,
        readers: [...readers, { name: "Somebody Else", readAt: AFTER }],
      },
      NOW,
    ),
    "Seen by Hazel, Rohail and 2 others",
  );
});

test("once there is nobody left to name it says everyone", () => {
  assert.equal(
    deliveryLabel(
      {
        at: SENT,
        deliveredAt: null,
        readAt: AFTER,
        readers: [
          { name: "Hazel Summers", readAt: AFTER },
          { name: "Rohail Khan", readAt: AFTER },
        ],
      },
      NOW,
    ),
    "Seen by everyone",
  );
});

test("one other person is a direct conversation, and keeps its time", () => {
  assert.equal(
    deliveryLabel(
      {
        at: SENT,
        deliveredAt: null,
        readAt: AFTER,
        readers: [{ name: "Rohail Khan", readAt: AFTER }],
      },
      NOW,
    ),
    "Seen 30m ago",
  );
});
