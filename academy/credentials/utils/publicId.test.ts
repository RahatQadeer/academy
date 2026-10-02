import assert from "node:assert/strict";
import test from "node:test";
import {
  extractCertificateNumber,
  formatCredentialPublicId,
  normalizeCredentialPublicId,
  parseCredentialPublicId,
} from "./publicId.ts";

test("extracts seven digits from bare and prefixed ids", () => {
  assert.equal(extractCertificateNumber("1234567"), "1234567");
  assert.equal(extractCertificateNumber("PA-SE-1234567"), "1234567");
  assert.equal(extractCertificateNumber("pa-cc 7654321"), "7654321");
  assert.equal(extractCertificateNumber("PA-CPA-1000001"), "1000001");
  assert.equal(extractCertificateNumber("PASE-1234567"), "1234567");
});

test("rejects non-seven-digit ids", () => {
  assert.equal(extractCertificateNumber("123456"), null);
  assert.equal(extractCertificateNumber("12345678"), null);
  assert.equal(extractCertificateNumber("PA-SE-A1B2C"), null);
  assert.equal(extractCertificateNumber(""), null);
});

test("format keeps hyphenated PA- prefixes", () => {
  assert.equal(formatCredentialPublicId("specialty_endorsement", "1234567"), "PA-SE-1234567");
  assert.equal(formatCredentialPublicId("certificate_of_completion", "1234567"), "PA-CC-1234567");
  assert.equal(formatCredentialPublicId("cpa_credential", "1234567"), "PA-CPA-1234567");
});

test("normalize and parse prefer the numeric id", () => {
  assert.equal(normalizeCredentialPublicId("PA-SE-1234567"), "1234567");
  assert.deepEqual(parseCredentialPublicId("1234567"), {
    number: "1234567",
    publicId: "1234567",
    displayHint: null,
  });
  assert.equal(parseCredentialPublicId("PA-CC-1234567")?.number, "1234567");
});
