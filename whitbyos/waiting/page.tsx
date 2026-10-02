import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { DataTable, DataTableCell, DataTableRow, type Column } from "@/whitbyos/components/DataTable";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Button } from "@/base/components/Button";
import { listWaitingOnYou } from "@/whitbyos/lib/search";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";

/** Access asks for a look rather than saying something is wrong. */
const TONES = { Approval: "warning", Review: "danger", Access: "review" } as const;

const COLUMNS: Column[] = [
  { label: "Client", width: "2fr" },
  { label: "What is waiting", width: "2.4fr" },
  { label: "Type", width: "1.2fr" },
  { label: "Since", width: "1fr" },
];

/**
 * 1.0b — the list behind the Dashboard's "Waiting on You" count.
 *
 * It reads the same set the count is derived from rather than counting a
 * second way, so the number on the card and the rows here can never disagree.
 */
export default async function WaitingOnYouPage() {
  const items = await listWaitingOnYou();
  const showClients = await usesClientWorkspaces();

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/whitbyos" className="no-underline">
          Home
        </Link>
        {" / "}
        <span style={{ color: "var(--ink)" }}>Waiting on You</span>
      </div>

      <h1 className="mb-5 text-[23px] font-bold">Waiting on You ({items.length})</h1>

      <p className="mb-5 text-[13px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
        Items across your Requests and Work Plans where the next
        step is yours, an approval, a review, or a reply.
      </p>

      {items.length === 0 ? (
        <StateMessage
          glyph="✓"
          title="Nothing is waiting on you"
          description="Every approval, review and access request has been dealt with."
          action={
            <Button unsized href="/whitbyos" variant="primary" className="px-5 py-2.5 text-[13.5px]">
              Back to Home
            </Button>
          }
        />
      ) : (
        <DataTable columns={showClients ? COLUMNS : COLUMNS.filter((column) => column.label !== "Client")} rowPadding={13}>
          {items.map((item) => (
            <DataTableRow key={item.id} href={item.href}>
              {showClients ? <DataTableCell emphasis="ink">{item.client}</DataTableCell> : null}
              <DataTableCell emphasis="ink">{item.what}</DataTableCell>
              <span>
                <Pill tone={TONES[item.type]}>{item.type}</Pill>
              </span>
              <DataTableCell>{item.since}</DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      )}
    </div>
  );
}
