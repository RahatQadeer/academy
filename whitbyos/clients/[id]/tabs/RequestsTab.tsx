import Link from "next/link";
import { EmptyNote } from "@/whitbyos/components/EmptyNote";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import { relativeTime, shortDate } from "@/whitbyos/lib/format";
import type { ClientRequest } from "@/whitbyos/lib/client-detail";
import { requestStatusLabel, requestStatusTone } from "@/whitbyos/lib/request-status";
import { Pill } from "@/base/components/Pill";

const COLUMNS: Column[] = [
  { label: "Request", width: "3fr" },
  { label: "Status", width: "1fr" },
  { label: "Due", width: "0.9fr" },
  { label: "Updated", width: "0.9fr" },
  // Holds the control rather than a fact, and wide enough for it.
  { label: "", width: "90px" },
];

export function RequestsTab({ requests }: { requests: ClientRequest[] }) {
  if (requests.length === 0) {
    return <EmptyNote>No requests for this client yet.</EmptyNote>;
  }

  return (
    <DataTable columns={COLUMNS}>
      {requests.map((request) => (
        <DataTableRow
          key={request.id}
          href={`/whitbyos/requests/${request.id}`}
          trailing={
            /* The row opens the request; this says so. Pressing a table row is
               a thing you have to already know. */
            <Link
              href={`/whitbyos/requests/${request.id}`}
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
          <DataTableCell emphasis="strong">{request.title}</DataTableCell>
          <span>
            <Pill tone={requestStatusTone(request.status)}>
              {requestStatusLabel(request.status)}
            </Pill>
          </span>
          <DataTableCell>{shortDate(request.target_date) || "Not set"}</DataTableCell>
          <DataTableCell emphasis="muted">
            {relativeTime(request.updated_at)}
          </DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  );
}
