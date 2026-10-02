import assert from "node:assert/strict";
import { test } from "node:test";
import { contactProblem, isEmail, isPhone, isWebsite } from "./contact-format.ts";

test("an email needs an at sign and a domain", () => {
  for (const good of ["omar@ahmedpartners.co.uk", "a@b.co", "first.last+tag@sub.example.com"]) {
    assert.ok(isEmail(good), good);
  }
  for (const bad of ["ahmedpartners", "omar@", "@example.com", "omar@example", "a b@c.com"]) {
    assert.equal(isEmail(bad), false, bad);
  }
});

test("an empty field is not a wrong one", () => {
  assert.ok(isEmail(""));
  assert.ok(isPhone("  "));
  assert.ok(isWebsite(""));
});

test("a phone number is digits and the marks between them", () => {
  for (const good of ["+44 20 7946 0102", "0312598328", "(020) 7946-0102", "+1 415 555 0134"]) {
    assert.ok(isPhone(good), good);
  }
  for (const bad of ["call me", "0312-ABC-598", "12345", "+" + "9".repeat(20)]) {
    assert.equal(isPhone(bad), false, bad);
  }
});

test("a website is a host, and a sentence is not", () => {
  for (const good of ["ahmedpartners.co.uk", "https://www.righttail.co/", "example.com/team"]) {
    assert.ok(isWebsite(good), good);
  }
  for (const bad of ["Solicitor, England & Wales. 15 years in immigration.", "righttail", "a b.com"]) {
    assert.equal(isWebsite(bad), false, bad);
  }
});

test("the first thing wrong is the thing said", () => {
  assert.match(contactProblem({ email: "nope" })!, /email/);
  assert.match(contactProblem({ phone: "call me" })!, /phone/);
  assert.match(contactProblem({ website: "a sentence here" })!, /website/);
  assert.equal(contactProblem({ email: "a@b.co", phone: "+44 20 7946 0102" }), null);
});
