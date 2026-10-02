import test from "node:test";
import assert from "node:assert/strict";
import { crc32 } from "node:zlib";
import {
  buildCourseGenContextBlock,
  condenseForTransport,
  detectAttachmentKind,
  extractHeadings,
  formatPdfPageText,
  genericCourseGenBlocked,
  htmlToStructuredText,
  isGenericCourseInstruction,
  isOutlineOnlyBody,
  lessonNeedsTeachingBody,
  looksLikeGenericCourseGen,
  splitIntoChunks,
  teachingContentIsComplete,
  titleReflectsSource,
  unsupportedAttachmentMessage,
} from "./courseAttachmentText.ts";

function prose(words: number) {
  return Array.from(
    { length: words },
    () => "Firewalls inspect packets at the network boundary and compare each request to a rule set.",
  )
    .join(" ")
    .split(/\s+/)
    .slice(0, words)
    .join(" ");
}

test("detects pdf, docx, and text kinds and rejects .doc", () => {
  assert.equal(detectAttachmentKind({ name: "guide.pdf", type: "application/pdf" }), "pdf");
  assert.equal(
    detectAttachmentKind({
      name: "notes.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "docx",
  );
  assert.equal(detectAttachmentKind({ name: "brief.md" }), "md");
  assert.equal(detectAttachmentKind({ name: "legacy.doc" }), null);
});

test("rejects unsupported types with a clear message", () => {
  assert.match(unsupportedAttachmentMessage("photo.png"), /PDF, Word \(\.docx\)/);
});

test("htmlToStructuredText keeps headings, lists, tables, and paragraphs", () => {
  const text = htmlToStructuredText(`
    <h1>Network Security</h1>
    <p>Firewalls inspect packets before they enter the network.</p>
    <h2>Controls</h2>
    <ul><li>Access control</li><li>Monitoring</li></ul>
    <table><tr><th>Layer</th><th>Control</th></tr><tr><td>Network</td><td>Firewall</td></tr></table>
  `);
  assert.match(text, /# Network Security/);
  assert.match(text, /## Controls/);
  assert.match(text, /- Access control/);
  assert.match(text, /Network \| Firewall/);
  assert.match(text, /Firewalls inspect packets/);
});

test("PDF page formatting keeps page markers and heading-like lines", () => {
  const page = formatPdfPageText(2, "INTRODUCTION TO CYBERSECURITY\nPasswords should be unique.");
  assert.match(page, /--- Page 2 ---/);
  assert.match(page, /## INTRODUCTION TO CYBERSECURITY/);
});

test("chunking covers later sections instead of dropping them", () => {
  const text = ["# One\n" + "alpha ".repeat(800), "# Two\n" + "bravo ".repeat(800), "# Three\n" + "charlie ".repeat(800)].join(
    "\n",
  );
  const chunks = splitIntoChunks(text, 2_000, 80);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.some((chunk) => chunk.includes("charlie")));
  assert.ok(chunks.some((chunk) => chunk.includes("Three")));
});

test("condenseForTransport keeps the last section of a long document", () => {
  const sections = Array.from({ length: 8 }, (_, index) => `## Topic ${index + 1}\n${"word ".repeat(4_000)}END-${index + 1}`);
  const result = condenseForTransport(sections.join("\n\n"), 8_000);
  assert.equal(result.condensed, true);
  assert.match(result.text, /Topic 1/);
  assert.match(result.text, /Topic 8/);
  assert.match(result.text, /END-8/);
});

test("generic instructions are detected and named subjects are not", () => {
  assert.equal(isGenericCourseInstruction("Create a course from this file."), true);
  assert.equal(isGenericCourseInstruction("Create a course related to this file"), true);
  assert.equal(isGenericCourseInstruction("Turn this document into a beginner-friendly course."), true);
  assert.equal(isGenericCourseInstruction("Create a cybersecurity course from this document."), false);
});

test("generic CourseGen titles fail source fidelity against a cybersecurity document", () => {
  const source = "Introduction to Cybersecurity. Firewalls, phishing, and access control.";
  assert.equal(looksLikeGenericCourseGen("Build Your First AI-Powered Course with a Prompt"), true);
  assert.equal(titleReflectsSource("Build Your First AI-Powered Course with a Prompt", source, ["cybersecurity.pdf"]), false);
  assert.equal(titleReflectsSource("Introduction to Cybersecurity", source, ["cybersecurity.pdf"]), true);
});

test("outline-only lesson bodies are rejected", () => {
  const outline = `# Module 1: Introduction
- Topic A
- Topic B
- Topic C
# Module 2: Advanced Concepts`;
  assert.equal(isOutlineOnlyBody(outline), true);
  const teaching = Array.from(
    { length: 40 },
    () =>
      "Firewalls inspect packets at the network boundary and compare each request to a rule set before allowing or denying it.",
  ).join(" ");
  assert.ok(teaching.split(/\s+/).length >= 250);
  assert.equal(isOutlineOnlyBody(teaching), false);
});

test("long heading-and-bullet skeletons are still outline-only", () => {
  const outline = Array.from(
    { length: 24 },
    (_, index) =>
      `## Topic ${index + 1}: Core idea\n- Point ${index + 1}a about the subject\n- Point ${index + 1}b about the subject\n- Point ${index + 1}c about the subject`,
  ).join("\n");
  assert.ok(outline.split(/\s+/).length > 250);
  assert.equal(isOutlineOnlyBody(outline), true);
  assert.equal(teachingContentIsComplete(outline, "beginner", "reading"), false);
});

test("teachingContentIsComplete honors selected level floors", () => {
  const short = prose(430);
  assert.equal(teachingContentIsComplete(short, "beginner", "reading"), true);
  assert.equal(teachingContentIsComplete(short, "intermediate", "reading"), false);
  assert.equal(teachingContentIsComplete(short, "advanced", "reading"), false);
  assert.equal(teachingContentIsComplete(prose(640), "advanced", "reading"), true);
  assert.equal(teachingContentIsComplete(prose(180), "intermediate", "assignment"), false);
  assert.equal(teachingContentIsComplete(prose(240), "intermediate", "assignment"), true);
  assert.equal(lessonNeedsTeachingBody("reading", ""), true);
  assert.equal(lessonNeedsTeachingBody("quiz", ""), false);
});

test("extractHeadings reads markdown structure", () => {
  assert.deepEqual(extractHeadings("# Access\n## Firewalls\nparagraph"), ["Access", "Firewalls"]);
});

test("puts SOURCE DOCUMENT before USER INSTRUCTION", () => {
  const block = buildCourseGenContextBlock({
    prompt: "Create a course related to this file",
    length: "4 modules",
    difficulty: "Beginner",
    type: "Paid Course",
    moduleCount: 4,
    source: {
      hasSource: true,
      fileNames: ["Introduction to Cybersecurity.pdf"],
      pageCount: 24,
      subjectHint: "Introduction to Cybersecurity",
      consolidated: "Firewalls, phishing, and access control protect networks.",
    },
  });

  assert.match(block, /SOURCE DOCUMENT \(PRIMARY/);
  assert.match(block, /USER INSTRUCTION/);
  assert.ok(block.indexOf("SOURCE DOCUMENT") < block.indexOf("USER INSTRUCTION"));
  assert.doesNotMatch(block, /^TOPIC: Create a course related to this file/m);
  assert.match(block, /Firewalls, phishing, and access control/);
  assert.match(block, /did not name a different subject/);
});

test("keeps a named transformation instruction while sourcing from the document", () => {
  const block = buildCourseGenContextBlock({
    prompt: "Create an advanced course using this document and add practical exercises.",
    length: "6 modules",
    difficulty: "Advanced",
    type: "Paid Course",
    moduleCount: 6,
    source: {
      hasSource: true,
      fileNames: ["business-fundamentals.docx"],
      pageCount: 0,
      subjectHint: "Business Fundamentals",
      consolidated: "Cash flow, pricing, and unit economics.",
    },
  });
  assert.match(block, /Cash flow, pricing, and unit economics/);
  assert.match(block, /add practical exercises/);
});

test("blocks generic CourseGen output when the source is unrelated", () => {
  assert.equal(
    genericCourseGenBlocked(
      "What an AI Course Generator Actually Does",
      "Introduction to Cybersecurity and network defense.",
    ),
    true,
  );
  assert.equal(
    genericCourseGenBlocked("Introduction to Cybersecurity", "Introduction to Cybersecurity and network defense."),
    false,
  );
});

test("pdf-parse extracts actual text from a PDF", async () => {
  const { PDFParse } = await import("pdf-parse");
  const stream = "BT /F1 24 Tf 72 720 Td (Introduction to Cybersecurity) Tj ET";
  const pdf = `%PDF-1.1
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${stream.length} >> stream
${stream}
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF
`;
  const parser = new PDFParse({ data: new Uint8Array(Buffer.from(pdf)) });
  try {
    const result = await parser.getText();
    const text = (result.pages ?? []).map((page: { text?: string }) => page.text ?? "").join("\n");
    assert.match(text, /Cybersecurity/);
    assert.doesNotMatch(text, /\[PDF attached:/);
  } finally {
    await parser.destroy();
  }
});

test("mammoth extracts DOCX headings, paragraphs, and lists into structured text", async () => {
  const mammoth = await import("mammoth");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Business Fundamentals</w:t></w:r></w:p>
    <w:p><w:r><w:t>Cash flow is the movement of money in and out of a business.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Unit economics</w:t></w:r></w:p>
    <w:p><w:r><w:t>Price minus variable cost equals contribution margin.</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Track weekly cash.</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const buffer = zipStore([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rels },
    { name: "word/document.xml", data: document },
  ]);
  const { value } = await mammoth.convertToHtml({ buffer });
  const text = htmlToStructuredText(value);
  assert.match(text, /# Business Fundamentals/);
  assert.match(text, /Cash flow is the movement of money/);
  assert.match(text, /## Unit economics/);
  assert.match(text, /contribution margin/);
});

function zipStore(entries: { name: string; data: string }[]) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name);
    const dataBuf = Buffer.from(entry.data);
    const crc = crc32(dataBuf) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuf.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const localFull = Buffer.concat([local, nameBuf, dataBuf]);
    locals.push(localFull);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dataBuf.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));
    offset += localFull.length;
  }
  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, eocd]);
}

