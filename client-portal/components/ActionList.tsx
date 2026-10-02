import { Button } from "@/base/components/Button";
import { BUTTON_SIZE } from "./buttons";
import { dueLabel } from "@/client-portal/lib/format";
import { Pill } from "@/base/components/Pill";
import type { ActionItem } from "@/client-portal/types";
import { TaskDoneButton } from "./TaskDoneButton";
import {
  PanelBody,
  PanelEmpty,
  PanelMeta,
  PanelRow,
  PanelRows,
  PanelTags,
  PanelTitle,
} from "./Panel";

/**
 * The Action Needed list — the portal's only work queue. Used on Home and
 * inside a Request, so the two never drift apart.
 *
 * Rows rather than the four-column table it was. The due date is the fact that
 * decides what a client does first, and as a column it was the one a phone
 * truncated; as a pill beside the kind it survives every width. The tile is
 * drawn in the warning colours throughout, because every row in this list is by
 * definition waiting on the reader.
 *
 * Only the rows: Home puts them in the list panel, and a Request's Overview
 * puts them inside its own Action Needed card.
 */
export function ActionList({
  items,
  timeZone = "UTC",
  canTick = false,
  returnTo = "/client-portal",
}: {
  items: ActionItem[];
  /** The professional's zone — see `PortalContext.timezone`. */
  timeZone?: string;
  /**
   * Whether a task on this list can be ticked off here (client-portal/020).
   * False for a view-only member, whose rows stay as they were.
   */
  canTick?: boolean;
  /** The screen the tick returns to — this list is on two of them. */
  returnTo?: string;
}) {
  if (items.length === 0) {
    return (
      <PanelEmpty
        glyph="✓"
        title="Nothing needs your attention"
        detail="When your team needs a form completed, a document reviewed, or an approval, it will appear here."
      />
    );
  }

  return (
    <PanelRows>
      {items.map((item) => {
        const due = dueLabel(item.dueLabel, new Date(), timeZone);
        const pressing = due === "Overdue" || due === "Due today";

        // Only open tasks reach this list, so the tick only ever completes;
        // undoing one is done where the finished task is still listed.
        const tick =
          canTick && item.taskId ? (
            <TaskDoneButton taskId={item.taskId} done={false} returnTo={returnTo} />
          ) : null;

        return (
          <PanelRow
            key={item.id}
            // No link where there is nothing to open — a Task named to the
            // account rather than to a Request has no screen of its own, and a
            // control that returns you to the list you are reading is worse
            // than no control.
            href={item.href ?? undefined}
            trailing={
              // A task asked of the client is finished by doing it, so the row
              // carries the tick as well as the way in. The other kinds are
              // finished on their own screen — a form by filling it in — and
              // have nothing to tick.
              tick || item.href ? (
                <>
                  {tick}
                  {item.href ? (
                    <Button
                      href={item.href}
                      variant={item.kind === "form" ? "primary" : "secondary"}
                      unsized
                      className={BUTTON_SIZE.row}
                    >
                      {item.ctaLabel}
                    </Button>
                  ) : null}
                </>
              ) : undefined
            }
          >
            <PanelBody>
              <PanelTitle>{item.title}</PanelTitle>
              <PanelMeta>{item.context ?? "Your account"}</PanelMeta>
              {due ? (
                <PanelTags>
                  <Pill tone={pressing ? "danger" : "neutral"}>{due}</Pill>
                </PanelTags>
              ) : null}
            </PanelBody>
          </PanelRow>
        );
      })}
    </PanelRows>
  );
}
