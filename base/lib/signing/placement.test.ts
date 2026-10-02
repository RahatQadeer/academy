import assert from "node:assert/strict";
import test from "node:test";
import { isSignablePdf, parsePlacements, toPdfRect, type PageBox } from "./placement.ts";

/**
 * A signature placed on screen has to land in the same spot on the paper,
 * whichever way the PDF happens to store the page.
 */

const letter: PageBox = { left: 0, bottom: 0, width: 612, height: 792, rotation: 0 };

const bottomRight = { page: 0, kind: "signature" as const, x: 0.5, y: 0.9, w: 0.4, h: 0.05 };

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≈ ${expected}`);
}

test("an upright page flips the vertical axis and nothing else", () => {
  const rect = toPdfRect(bottomRight, letter);
  close(rect.x, 306);
  close(rect.y, 792 * 0.05);
  close(rect.width, 612 * 0.4);
  close(rect.height, 792 * 0.05);
  assert.equal(rect.rotate, 0);
});

test("a crop box offset moves the stamp with it", () => {
  const rect = toPdfRect(bottomRight, { ...letter, left: 20, bottom: 30 });
  close(rect.x, 326);
  close(rect.y, 30 + 792 * 0.05);
});

test("a page stored upright and shown turned 90° keeps the stamp where it was seen", () => {
  // Shown landscape: 792 wide, 612 tall.
  const box: PageBox = { ...letter, rotation: 90 };
  const rect = toPdfRect(bottomRight, box);
  // Seen bottom-left of the stamp is (0.5, 0.95); at 90° seen-down is stored +x
  // and seen-right is stored +y.
  close(rect.x, 0.95 * 612);
  close(rect.y, 0.5 * 792);
  close(rect.width, 0.4 * 792);
  close(rect.height, 0.05 * 612);
  assert.equal(rect.rotate, 90);
});

test("180° and 270° pages anchor from the opposite corners", () => {
  const half = toPdfRect(bottomRight, { ...letter, rotation: 180 });
  close(half.x, 612 * 0.5);
  close(half.y, 792 * 0.95);
  assert.equal(half.rotate, 180);

  const three = toPdfRect(bottomRight, { ...letter, rotation: -90 });
  close(three.x, 612 * 0.05);
  close(three.y, 792 * 0.5);
  assert.equal(three.rotate, 270);
});

test("placements are refused whole when any of them is wrong", () => {
  const good = JSON.stringify([bottomRight, { ...bottomRight, kind: "date", page: 1 }]);
  assert.equal(parsePlacements(good, 2)?.length, 2);

  assert.equal(parsePlacements(good, 1), null, "page past the end");
  assert.equal(parsePlacements("[]", 2), null, "nothing placed");
  assert.equal(parsePlacements("not json", 2), null);
  assert.equal(parsePlacements(JSON.stringify([{ ...bottomRight, x: 0.8 }]), 2), null, "off the edge");
  assert.equal(parsePlacements(JSON.stringify([{ ...bottomRight, kind: "stamp" }]), 2), null);
  assert.equal(parsePlacements(JSON.stringify([{ ...bottomRight, w: Number.NaN }]), 2), null);
});

test("only a stored PDF can be signed on screen", () => {
  assert.equal(isSignablePdf("client-1/1712-lease.pdf"), true);
  assert.equal(isSignablePdf("client-1/1712-LEASE.PDF"), true);
  assert.equal(isSignablePdf("client-1/1712-lease.docx"), false);
  assert.equal(isSignablePdf("https://dropbox.com/s/lease.pdf"), false);
  assert.equal(isSignablePdf(""), false);
  assert.equal(isSignablePdf(null), false);
});
