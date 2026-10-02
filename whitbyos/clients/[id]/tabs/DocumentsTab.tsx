import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { EmptyNote } from "@/whitbyos/components/EmptyNote";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import { relativeTime, statusLabel } from "@/whitbyos/lib/format";
import type { ClientDocument, ClientFormAnswer } from "@/whitbyos/lib/client-detail";

const COLUMNS: Column[] = [
  { label: "Name", width: "3fr" },
  { label: "Category", width: "1.3fr" },
  { label: "Request", width: "1.6fr" },
  { label: "Arrived", width: "0.9fr" },
  // Holds the control rather than a fact.
  { label: "", width: "90px" },
];

/**
 * One row of everything that has passed between the firm and this client.
 *
 * Three kinds, and they were not distinguishable: a file the client uploaded
 * from the portal, a file the team filed here, and a form the client filled in
 * and sent back — the last of which lives in another table and so was not on
 * this tab at all, while the documents that arrived beside it were. The
 * category says which of the three a row is, and every row can be opened.
 */
type Row = {
  key: string;
  title: string;
  category: "From the client" | "Filed by the team" | "Form answer";
  request: string | null;
  at: string;
  href: string;
  status?: string;
};

const TONES: Record<Row["category"], "info" | "neutral" | "success"> = {
  "From the client": "info",
  "Filed by the team": "neutral",
  "Form answer": "success",
};

const PAGE = 15;

export function DocumentsTab({
  documents,
  forms = [],
  clientId,
  category,
  show,
}: {
  documents: ClientDocument[];
  /** What this client has filled in and sent back. */
  forms?: ClientFormAnswer[];
  clientId: string;
  /** Which category is being read, from `?kind=`. Absent is all of them. */
  category?: string;
  /** How many rows to draw, from `?show=`. Fifteen unless asked for more. */
  show?: string;
}) {
  const rows: Row[] = [
    ...documents.map((document) => ({
      key: `document-${document.id}`,
      title: document.title,
      category:
        document.source === "client"
          ? ("From the client" as const)
          : ("Filed by the team" as const),
      request: document.request_title,
      at: document.created_at,
      // The Documents screen opens one in a dialog; this is the same door.
      href: `/whitbyos/documents?doc=${document.id}`,
    })),
    ...forms.map((form) => ({
      key: `form-${form.id}`,
      title: form.title,
      category: "Form answer" as const,
      request: null,
      at: form.submitted_at,
      href: `/whitbyos/forms?tab=submissions&review=${form.id}`,
      status: form.status,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  /*
   * One filter, above one list.
   *
   * Four form answers among twenty files is four things somebody is looking
   * for and cannot see, and "everything this client has sent" and "everything
   * we have filed" are two different questions asked of one tab. The counts
   * are on the tabs because the answer to "is there anything?" should not
   * require pressing anything.
   */
  const counts = {
    all: rows.length,
    "From the client": rows.filter((row) => row.category === "From the client").length,
    "Form answer": rows.filter((row) => row.category === "Form answer").length,
    "Filed by the team": rows.filter((row) => row.category === "Filed by the team").length,
  };

  const shown =
    category && category !== "all"
      ? rows.filter((row) => row.category === category)
      : rows;

  const filters = (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {(["all", "From the client", "Form answer", "Filed by the team"] as const).map(
        (key) => {
          const current = (category ?? "all") === key;
          const count = counts[key];

          return (
            <Link
              key={key}
              href={
                key === "all"
                  ? `/whitbyos/clients/${clientId}/documents`
                  : `/whitbyos/clients/${clientId}/documents?kind=${encodeURIComponent(key)}`
              }
              className="rounded-full border px-3 py-[5px] text-[12.5px] font-medium no-underline transition-colors"
              style={{
                borderColor: current ? "transparent" : "var(--chrome-line)",
                background: current ? "var(--accent-tint)" : "var(--surface)",
                color: current ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {key === "all" ? "Everything" : key}
              <span style={{ color: current ? "var(--accent)" : "var(--text-quiet)" }}>
                {" "}
                {count}
              </span>
            </Link>
          );
        },
      )}
    </div>
  );

  if (rows.length === 0) {
    return <EmptyNote>Nothing filed against this client yet.</EmptyNote>;
  }

  if (shown.length === 0) {
    return (
      <>
        {filters}
        <EmptyNote>Nothing in this category yet.</EmptyNote>
      </>
    );
  }

  /*
   * Fifteen, then ask.
   *
   * A client with four years of filing is a scroll nobody reaches the end of,
   * and the answer to "what has arrived lately" is in the first few rows. The
   * count on the button says what pressing it is worth.
   */
  const asked = Number(show);
  const limit = Number.isFinite(asked) && asked > 0 ? asked : PAGE;
  const page = shown.slice(0, limit);
  const rest = shown.length - page.length;

  const moreHref = (() => {
    const query = new URLSearchParams();
    if (category && category !== "all") query.set("kind", category);
    query.set("show", String(limit + PAGE));
    return `/whitbyos/clients/${clientId}/documents?${query.toString()}`;
  })();

  return (
    <>
    {filters}
    <DataTable columns={COLUMNS}>
      {page.map((row) => (
        <DataTableRow
          key={row.key}
          href={row.href}
          trailing={
            <Link
              href={row.href}
              className="rounded-control border px-3 py-[5px] text-[12.5px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
              style={{
                borderColor: "var(--border-strong)",
                background: "var(--surface)",
                color: "var(--ink)",
              }}
            >
              View
            </Link>
          }
        >
          <DataTableCell emphasis="strong">
            <span className="block truncate" title={row.title}>
              {row.title}
            </span>
            {row.status ? (
              <span className="mt-0.5 block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {statusLabel(row.status)}
              </span>
            ) : null}
          </DataTableCell>

          <span>
            <Pill tone={TONES[row.category]}>{row.category}</Pill>
          </span>

          <DataTableCell>{row.request ?? "No request"}</DataTableCell>
          <DataTableCell emphasis="muted">{relativeTime(row.at)}</DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>

    {rest > 0 ? (
      <div className="mt-4 flex justify-center">
        <Link
          href={moreHref}
          className="rounded-control border px-4 py-[8px] text-[13px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
          style={{
            borderColor: "var(--border-strong)",
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        >
          Show {Math.min(rest, PAGE)} more
          <span style={{ color: "var(--text-quiet)" }}> · {rest} left</span>
        </Link>
      </div>
    ) : null}
    </>
  );
}
