"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { dropTask, dropWorkstream } from "@/whitbyos/work-plans/actions";

/**
 * Dragging tasks about, in every view that is a list of them.
 *
 * The board could not be worked: moving a card from Not Started to Running was
 * opening the task, changing a select and coming back, which is three screens
 * for the one gesture a board exists for. And the order tasks were read in was
 * the order Whitby drafted them in, which is not the order anybody works them.
 *
 * Two pieces. `DropColumn` is whatever the tasks are sitting in: a Kanban
 * lane, a stream's rows in the List, the body of the Table. `DragTask` wraps
 * each one. The cards themselves are still drawn on the server; this only
 * carries them.
 *
 * Plain HTML drag and drop rather than a library: the elements are server
 * components with their own markup, and nothing here needs to animate a
 * reorder, only to say where the thing was let go.
 */

/** What the drag is carrying, read on drop. */
const MIME = "application/x-whitby-task";

export function DragTask({
  id,
  children,
  className,
  /** A row rather than a card, so the line is drawn above it rather than round it. */
  row,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  row?: boolean;
}) {
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  /*
   * The links inside stop being draggable themselves.
   *
   * A card is a link and an anchor is draggable by default, so pressing one
   * and moving started the browser's own link drag: a ghost of the URL, no
   * drop target that would take it, and nothing that looked like moving a
   * card. The wrapper is the only thing that drags now.
   */
  useEffect(() => {
    const links = box.current?.querySelectorAll<HTMLElement>("a, img");
    links?.forEach((link) => {
      link.draggable = false;
    });
  });

  return (
    <div
      ref={box}
      draggable
      data-task-id={id}
      /* The whole thing is the handle, and says so: a card is a link, and a
         link's own pointer cursor sits on top of anything the wrapper asks
         for, so the grab has to be painted through it. */
      className={`pa-drag ${className ?? ""}`}
      onDragStart={(event) => {
        event.dataTransfer.setData(MIME, id);
        /*
         * And as plain text, because the card is a link.
         *
         * A browser dragging an anchor fills the drag with its URL, and
         * Firefox refuses a drag that sets no text at all; saying both leaves
         * nothing to chance and costs one line.
         */
        event.dataTransfer.setData("text/plain", id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => {
        setDragging(false);
        setOver(false);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(MIME)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => setOver(false)}
      style={{
        position: "relative",
        opacity: dragging ? 0.4 : undefined,
        // Where it would land: above the thing under the cursor.
        boxShadow: over ? "inset 0 3px 0 -1px var(--accent)" : undefined,
        borderRadius: row ? undefined : 10,
      }}
    >
      {children}

      {/* The mark that says this can be picked up. Drawn over the card rather
          than inside it, because the card is drawn on the server and knows
          nothing about being dragged. */}
      <span
        aria-hidden
        className="pa-drag-grip"
        title="Drag to move"
        style={{
          position: "absolute",
          top: row ? 4 : 6,
          right: row ? 4 : 8,
          lineHeight: 1,
          fontSize: 13,
          letterSpacing: "-1px",
          color: "var(--text-disabled)",
          pointerEvents: "none",
        }}
      >
        ⠿
      </span>
    </div>
  );
}

export function DropColumn({
  planId,
  group,
  lane,
  kind = "task",
  children,
  className,
  style,
}: {
  planId: string;
  /** Tasks, or the Work Streams themselves — which is what the Grid moves. */
  kind?: "task" | "stream";
  /** What this column means. Absent where the view only reorders. */
  group?: "status" | "stream" | "owner" | null;
  /** The column's own key: a status, a stream id, a user id, or "". */
  lane?: string | null;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);

  return (
    <div
      onDragOver={(event) => {
        // Chrome hides the dragged data until the drop, so what is being
        // carried is only knowable by the type being present.
        if (!event.dataTransfer.types.includes(MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={(event) => {
        // Leaving for a child is not leaving.
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setOver(false);
      }}
      onDrop={(event) => {
        const taskId = event.dataTransfer.getData(MIME) || event.dataTransfer.getData("text/plain");
        setOver(false);
        if (!taskId) return;
        event.preventDefault();

        /*
         * What it was dropped above.
         *
         * The nearest task whose middle is below the cursor: that is the one
         * it goes in front of, and none means the end of the column.
         */
        const cards = [
          ...event.currentTarget.querySelectorAll<HTMLElement>("[data-task-id]"),
        ].filter((card) => card.dataset.taskId !== taskId);

        const beforeId =
          cards.find((card) => {
            const box = card.getBoundingClientRect();
            return event.clientY < box.top + box.height / 2;
          })?.dataset.taskId ?? null;

        start(async () => {
          setFailed(null);
          const result =
            kind === "stream"
              ? await dropWorkstream({ planId, streamId: taskId, beforeId })
              : await dropTask({ planId, taskId, group, lane, beforeId });

          if (!result.ok) setFailed(result.error ?? "That did not move.");
          else router.refresh();
        });
      }}
      className={className}
      style={{
        ...style,
        outline: over ? "2px dashed var(--accent)" : undefined,
        outlineOffset: over ? 2 : undefined,
        opacity: pending ? 0.75 : undefined,
      }}
    >
      {children}

      {failed ? (
        <p className="mt-2 text-[11.5px]" style={{ color: "var(--danger-text)" }}>
          {failed}
        </p>
      ) : null}
    </div>
  );
}
