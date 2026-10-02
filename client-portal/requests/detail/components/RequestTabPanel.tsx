import {
  DataTable,
  DataTableCell,
  DataTableFixed,
  DataTableRow,
  type Column,
} from "@/client-portal/components/DataTable";
import { Avatar } from "@/base/components/Avatar";
import { Button } from "@/base/components/Button";
import { BUTTON_SIZE } from "@/client-portal/components/buttons";
import { shortDate, timeRange } from "@/client-portal/lib/format";
import { DOCUMENT_STATUS, FORM_STATUS, formActionLabel } from "@/client-portal/lib/status";
import { Row, RowList, RowMeta } from "@/client-portal/components/Surface";
import { StatusPill } from "@/client-portal/components/StatusPill";
import { TaskDoneButton } from "@/client-portal/components/TaskDoneButton";
import { EmptyState } from "@/client-portal/components/States";
import { RequestPlansPanel } from "./RequestPlansPanel";
import type {
  CalendarItem,
  PortalDocument,
  PortalForm,
  PortalNote,
  PortalPlan,
  TaskStatus,
} from "@/client-portal/types";

/**
 * One row of a Request's Tasks tab.
 *
 * Two sources, one list: the tasks marked client-visible on this Request, and
 * every task in a Work Plan shared on it. A task that is both is listed once.
 * `planName` says which rows came with a plan.
 */
export type RequestTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  dueAt: string | null;
  completedAt: string | null;
  ownerName: string | null;
  planName: string | null;
  /**
   * Whether the client may tick this one themselves (client-portal/020,
   * 023): the tasks marked client-visible on this Request, and every task in
   * a Work Plan shared on it — the two reads `setTaskDone` authorises against.
   */
  canComplete: boolean;
};

export type RequestPanelTab =
  | "tasks"
  | "notes"
  | "documents"
  | "plans"
  | "forms"
  | "calendar";

/**
 * The tabs of a Request after Overview, each scoped to that request.
 *
 * Tasks, Notes, Documents, Work Plans and Forms are Whitby's own five (3.3t,
 * 3.3n, 3.3d, 3.3w, 3.3f), drawn with the same columns so a client and their
 * attaché are reading the same table. Calendar is the portal's.
 *
 * Work Plans is the one that is not a table: a plan is the shape of the work
 * rather than a list of rows, so `RequestPlansPanel` draws it as WP.17 draws
 * it. It is the only tab here whose body lives in its own file.
 */
/**
 * The three tables this panel draws.
 *
 * Each used to declare its own `[grid-template-columns:…]` string and repeat it
 * on the header and on every row, so a column width was two literals that had
 * to be kept equal by hand. `DataTable` sets the template once as a variable
 * the rows inherit, which is the same reason the Requests and Forms screens use
 * it: a header and its rows cannot drift apart.
 *
 * Tasks is the one whose columns are not fixed: the last one exists only when
 * there is something to put in it, so a view-only member, or a Request whose
 * every task came with a shared plan, gets the three this table has always had
 * rather than an empty fourth.
 */
function taskColumns(withControl: boolean): Column[] {
  const columns: Column[] = [
    { label: "Task", width: "2.2fr" },
    { label: "Owner", width: "1fr" },
    { label: "Due", width: "1fr" },
  ];
  if (withControl) columns.push({ label: "", width: "170px" });
  return columns;
}

const FORM_COLUMNS: Column[] = [
  { label: "Form", width: "2fr" },
  { label: "Status", width: "150px" },
  { label: "Sent", width: "0.8fr" },
  { label: "Updated", width: "0.8fr" },
  { label: "", width: "150px" },
];

const DOCUMENT_COLUMNS: Column[] = [
  { label: "Document", width: "2fr" },
  { label: "Status", width: "150px" },
  { label: "Updated", width: "1fr" },
];

export function RequestTabPanel({
  tab,
  requestId,
  tasks,
  canTick = false,
  notes,
  plans,
  requestTitle,
  forms,
  documents,
  calendar,
  timeZone = "UTC",
}: {
  tab: RequestPanelTab;
  requestId: string;
  tasks: RequestTaskRow[];
  /**
   * Whether this reader may tick a task off. False for a view-only member —
   * `setTaskDone` refuses them again server-side, this only keeps the button
   * out of a row they cannot use.
   */
  canTick?: boolean;
  notes: PortalNote[];
  /** The Work Plans shared on this Request — `listRequestPlans()`. */
  plans: PortalPlan[];
  /** The Request's own title, which a plan carries as the thing it belongs to. */
  requestTitle: string;
  forms: PortalForm[];
  documents: PortalDocument[];
  calendar: CalendarItem[];
  /**
   * The professional's zone — every date on these rows was decided in it, and
   * `whitbyos/lib/zoned.ts` draws it in it. See `PortalContext.timezone`.
   */
  timeZone?: string;
}) {
  const now = new Date();

  if (tab === "tasks") {
    if (tasks.length === 0) {
      return (
        <EmptyState
          glyph="☐"
          title="No tasks on this request"
          body="Tasks your team shares with you, and the tasks in any Work Plan they share, appear here."
        />
      );
    }

    const open = tasks.filter((task) => task.status !== "completed");
    const done = tasks.filter((task) => task.status === "completed");
    const tickable = canTick && tasks.some((task) => task.canComplete);
    // Back to this tab, not to the Request's Overview.
    const here = `/client-portal/requests/${requestId}?tab=tasks`;

    return (
      <DataTable columns={taskColumns(tickable)} rowPadding={13}>
        {[...open, ...done].map((task) => {
          const complete = task.status === "completed";
          const overdue = !complete && task.dueAt ? new Date(task.dueAt) < now : false;

          return (
            <DataTableRow key={task.id}>
              <span className="min-w-0 pr-3">
                <span
                  className="block truncate"
                  style={
                    complete
                      ? { color: "var(--text-secondary)", textDecoration: "line-through" }
                      : undefined
                  }
                  title={task.title}
                >
                  {task.title}
                </span>
                {task.planName ? (
                  <span
                    className="block truncate text-[11.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {task.planName}
                  </span>
                ) : null}
              </span>

              <DataTableFixed>
                {task.ownerName ? (
                  <span title={task.ownerName} className="inline-flex min-w-0 items-center gap-2">
                    <Avatar name={task.ownerName} size={22} className="text-[9.5px]" />
                    <span
                      className="truncate text-[12.5px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {task.ownerName.split(" ")[0]}
                    </span>
                  </span>
                ) : (
                  <span className="text-[12px]" style={{ color: "var(--text-quiet)" }}>
                    Unassigned
                  </span>
                )}
              </DataTableFixed>

              <span
                className="text-[12.5px]"
                style={{
                  color: complete
                    ? "var(--success-fg)"
                    : overdue
                      ? "var(--danger-fg)"
                      : "var(--text-secondary)",
                }}
              >
                {complete
                  ? "Done"
                  : overdue
                    ? "Overdue"
                    : task.dueAt
                      ? shortDate(task.dueAt, now, timeZone)
                      : "No date"}
              </span>

              {tickable ? (
                <DataTableFixed align="end">
                  {task.canComplete ? (
                    <TaskDoneButton
                      taskId={task.id}
                      done={complete}
                      returnTo={here}
                      requestId={requestId}
                    />
                  ) : null}
                </DataTableFixed>
              ) : null}
            </DataTableRow>
          );
        })}
      </DataTable>
    );
  }

  if (tab === "notes") {
    if (notes.length === 0) {
      return (
        <EmptyState
          glyph="✎"
          title="No notes shared yet"
          body="Notes your team writes for you on this request will appear here."
        />
      );
    }
    return (
      <div className="flex flex-col gap-2.5">
        {notes.map((note) => (
          <div key={note.id} className="rounded-card-cp border border-line bg-surface px-4 py-3.5">
            <p className="mb-2 whitespace-pre-wrap text-[13.5px] leading-[1.7]">{note.body}</p>
            <div className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
              {note.authorName ? `${note.authorName} · ` : ""}
              {shortDate(note.createdAt, now, timeZone)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tab === "plans") {
    return (
      <RequestPlansPanel
        plans={plans}
        requestId={requestId}
        requestTitle={requestTitle}
        canTick={canTick}
      />
    );
  }

  if (tab === "forms") {
    if (forms.length === 0) {
      return (
        <EmptyState
          glyph="▤"
          title="No forms on this request"
          body="If your team needs information, a form will show up here."
        />
      );
    }
    return (
      <DataTable columns={FORM_COLUMNS} rowPadding={13}>
        {forms.map((form) => {
          const updated = form.submittedAt ?? form.reviewedAt ?? form.sentAt;
          return (
            <DataTableRow
              key={form.id}
              href={`/client-portal/forms/${form.id}`}
              trailing={
                <Button href={`/client-portal/forms/${form.id}`} variant="secondary" unsized className={BUTTON_SIZE.row}>
                  {formActionLabel(form.status)}
                </Button>
              }
            >
              <DataTableCell emphasis="ink">{form.title}</DataTableCell>

              <DataTableFixed>
                <StatusPill status={FORM_STATUS[form.status]} />
              </DataTableFixed>

              <DataTableCell>
                {form.sentAt ? shortDate(form.sentAt, now, timeZone) : "—"}
              </DataTableCell>

              <DataTableCell emphasis="muted">
                {updated ? shortDate(updated, now, timeZone) : "—"}
              </DataTableCell>
            </DataTableRow>
          );
        })}
      </DataTable>
    );
  }

  if (tab === "documents") {
    if (documents.length === 0) {
      return (
        <EmptyState
          glyph="▥"
          title="No documents shared"
          body="Files your team shares on this request will appear here."
        />
      );
    }
    return (
      <DataTable columns={DOCUMENT_COLUMNS} rowPadding={13}>
        {documents.map((doc) => (
          <DataTableRow key={doc.id} href="/client-portal/documents">
            <span className="min-w-0 truncate pr-3">
              {doc.title}
              <span className="ml-2 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                v{doc.version}
              </span>
            </span>

            <DataTableFixed>
              <StatusPill status={DOCUMENT_STATUS[doc.status]} />
            </DataTableFixed>

            <DataTableCell emphasis="muted">
              {shortDate(doc.sharedAt, now, timeZone)}
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    );
  }

  const scoped = calendar.filter((item) => item.requestId === requestId);
  if (scoped.length === 0) {
    return (
      <EmptyState
        glyph="▦"
        title="Nothing scheduled"
        body="Meetings and key dates linked to this request will appear here."
      />
    );
  }
  return (
    <RowList>
      {scoped.map((item) => (
        <Row key={item.id}>
          <div className="w-16 shrink-0">
            <RowMeta>{shortDate(item.startAt, now, timeZone)}</RowMeta>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium">{item.title}</div>
            <RowMeta>
              {[
                // `allDay` rather than a missing `end_at`: a Google all-day
                // entry has both ends, at midnight, and reading them said
                // "12:00 AM – 12:00 AM".
                item.allDay
                  ? "All day"
                  : timeRange(item.startAt, item.endAt, timeZone),
                item.location,
              ]
                .filter(Boolean)
                .join(" · ")}
            </RowMeta>
          </div>
        </Row>
      ))}
    </RowList>
  );
}
