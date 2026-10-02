import { renderToStream } from "@react-pdf/renderer";
import { getClient, listClientRequests, listClientTimeline } from "@/whitbyos/lib/client-detail";
import { TimelineDocument } from "@/whitbyos/clients/[id]/timeline/document";
import { inlineLogo } from "@/whitbyos/lib/pdf-logo";
import { listHistory } from "@/whitbyos/lib/client-sections";
import { getSessionProfile } from "@/base/identity/session";
import { getWorkspaceMark } from "@/whitbyos/lib/workspace";

function longDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

function since(range: string) {
  const now = new Date();
  if (range === "30") return new Date(now.getTime() - 30 * 86_400_000);
  if (range === "90") return new Date(now.getTime() - 90 * 86_400_000);
  if (range === "year") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return null;
}

/**
 * Screen 2.1.6's export — a PDF file, not a page to print.
 *
 * It used to answer with a print-ready web page that opened with the browser's
 * print dialog up. That works, and it leaves the last step to the reader:
 * choose a destination, find "Save as PDF", press it. Pressing Export should
 * hand over a file. `@react-pdf/renderer` is already here for the Work Plan
 * export, so this is the same pipeline with a different document rather than a
 * new dependency.
 *
 * getClient does the workspace check, so another workspace's client is a 404
 * rather than a document.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const from = since(url.searchParams.get("range") ?? "all");
  const wantWork = url.searchParams.get("work") === "1";
  const wantMessages = url.searchParams.get("messages") === "1";
  const wantDocuments = url.searchParams.get("documents") === "1";
  // 2.1.6 offers this and the route never read it, so the box did nothing.
  const wantWhitby = url.searchParams.get("whitby") === "1";

  const requests = await listClientRequests(id);
  const [timeline, history] = await Promise.all([
    listClientTimeline(requests),
    listHistory(id, requests),
  ]);

  const inRange = (iso: string) => !from || new Date(iso) >= from;

  const events = timeline.filter((entry) => inRange(entry.created_at));
  const notes = wantMessages
    ? history.filter((entry) => inRange(entry.created_at))
    : history.filter((entry) => entry.kind === "note" && inRange(entry.created_at));

  // 2.1.7 groups the report under the same headings 2.1.6 offers to include,
  // which is the only grouping the reader has been given a say in. The events
  // themselves are one table of sentences this app writes — "Document
  // uploaded: …", "Whitby drafted a plan for …" — so they are sorted by the
  // wording they were written with rather than by a column that does not exist.
  const section = (text: string) => {
    if (/^document\b/i.test(text)) return "documents";
    if (/whitby/i.test(text)) return "whitby";
    return "work";
  };

  type Row = { at: string; body: string; detail?: string | null };
  const groups: { key: string; heading: string; rows: Row[] }[] = [
    { key: "work", heading: "Requests & Work Plans", rows: [] },
    { key: "documents", heading: "Documents", rows: [] },
    { key: "whitby", heading: "Whitby Activity", rows: [] },
    { key: "messages", heading: "Messages & Updates", rows: [] },
  ];

  const wanted = new Set(
    [
      wantWork && "work",
      wantDocuments && "documents",
      wantWhitby && "whitby",
      wantMessages && "messages",
    ].filter(Boolean) as string[],
  );

  for (const entry of events) {
    const key = section(entry.description);
    if (!wanted.has(key)) continue;
    groups
      .find((group) => group.key === key)!
      .rows.push({ at: entry.created_at, body: entry.description, detail: entry.request_title });
  }

  if (wanted.has("messages")) {
    for (const entry of notes) {
      groups
        .find((group) => group.key === "messages")!
        .rows.push({ at: entry.created_at, body: entry.body, detail: entry.detail });
    }
  }

  for (const group of groups) {
    group.rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);

  const [profile, mark] = await Promise.all([getSessionProfile(), getWorkspaceMark()]);
  const author =
    profile?.user.preferred_name || profile?.user.full_name || profile?.user.email || "";

  const rangeLabel =
    url.searchParams.get("range") === "30"
      ? "Last 30 days"
      : url.searchParams.get("range") === "90"
        ? "Last 90 days"
        : url.searchParams.get("range") === "year"
          ? "This year"
          : "All time";

  const slug = client.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "client";

  const stream = await renderToStream(
    <TimelineDocument
      clientName={client.name}
      firmName={mark?.name ?? ""}
      initials={mark?.initials ?? "PA"}
      logo={await inlineLogo(mark?.logoUrl ?? null)}
      rangeLabel={rangeLabel}
      printed={longDate(new Date().toISOString())}
      preparedBy={author}
      total={total}
      groups={groups.map((group) => ({
        heading: group.heading,
        rows: group.rows.map((row) => ({
          at: row.at,
          body: row.body,
          detail: row.detail ?? null,
        })),
      }))}
      longDate={longDate}
    />,
  );

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      // attachment, so pressing Export puts a file where files go rather than
      // opening one more thing to read on screen.
      "Content-Disposition": `attachment; filename="${slug}-timeline.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
