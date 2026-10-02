import test from "node:test";
import assert from "node:assert/strict";

import { addressIn, displayNameIn, header, textOf } from "./gmail-message.ts";

const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64url");

test("header finds a name whatever case Gmail sent it in", () => {
  const payload = {
    headers: [
      { name: "From", value: "a@x.com" },
      { name: "SUBJECT", value: "The villa" },
    ],
  };
  assert.equal(header(payload, "from"), "a@x.com");
  assert.equal(header(payload, "Subject"), "The villa");
  assert.equal(header(payload, "Cc"), null);
  assert.equal(header(undefined, "From"), null);
});

test("addressIn takes the address out of a display name", () => {
  // The display name is chosen by the sender, so it is never the permission.
  assert.equal(addressIn("Jordan Hartwell <J.Hartwell@Example.com>"), "j.hartwell@example.com");
  assert.equal(addressIn("plain@example.com"), "plain@example.com");
  assert.equal(addressIn("  Spaced@Example.com  "), "spaced@example.com");
  assert.equal(addressIn(null), "");
  assert.equal(addressIn(undefined), "");
});

test("displayNameIn keeps the sender's own spelling, or says there was none", () => {
  assert.equal(displayNameIn("Jordan Hartwell <j@x.com>"), "Jordan Hartwell");
  // Gmail quotes a name containing a comma; the quotes are not part of it.
  assert.equal(displayNameIn('"Hartwell, Jordan" <j@x.com>'), "Hartwell, Jordan");
  assert.equal(displayNameIn("  Spaced Name   <j@x.com>"), "Spaced Name");
  // A bare address has no name in front of it, and "" is not a name.
  assert.equal(displayNameIn("j@x.com"), null);
  assert.equal(displayNameIn("<j@x.com>"), null);
  assert.equal(displayNameIn(null), null);
});

test("textOf prefers text/plain however deeply it is nested", () => {
  // multipart/mixed wrapping multipart/alternative is what a reply with an
  // attachment actually looks like, and the first part is not the body.
  const payload = {
    mimeType: "multipart/mixed",
    parts: [
      {
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/plain", body: { data: b64("The flight is confirmed.") } },
          { mimeType: "text/html", body: { data: b64("<p>The flight is confirmed.</p>") } },
        ],
      },
      { mimeType: "application/pdf", body: { data: b64("%PDF") } },
    ],
  };
  assert.equal(textOf(payload), "The flight is confirmed.");
});

test("textOf falls back to HTML with its markup taken out", () => {
  const payload = {
    mimeType: "text/html",
    body: {
      data: b64(
        "<style>p{color:red}</style><script>x()</script><p>Deposit of <b>$4,000</b> is due Friday.</p>",
      ),
    },
  };
  // Style and script are removed with their contents; the tags around the
  // sentence become spaces rather than being glued to the words.
  assert.equal(textOf(payload), "Deposit of $4,000 is due Friday.");
});

test("textOf decodes base64url, which is not base64", () => {
  // Gmail uses the URL-safe alphabet: "-" and "_" where base64 has "+" and
  // "/". Decoding it as plain base64 mangles any body whose bytes hit those.
  const text = "Rates: ~85% (confirm?) <<flagged>> {ok} | 100% ?";
  const payload = { mimeType: "text/plain", body: { data: b64(text) } };
  assert.equal(textOf(payload), text);
  assert.ok(/[-_]/.test(b64(text)), "the fixture must exercise the URL-safe alphabet");
});

test("textOf answers with nothing rather than throwing on an empty message", () => {
  assert.equal(textOf(undefined), "");
  assert.equal(textOf({}), "");
  assert.equal(textOf({ mimeType: "text/plain" }), "");
  assert.equal(textOf({ mimeType: "multipart/mixed", parts: [] }), "");
});
