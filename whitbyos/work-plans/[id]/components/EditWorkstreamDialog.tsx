"use client";

import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, CONTROL_UNSIZED, Field } from "@/whitbyos/components/Field";
import { saveWorkstream } from "@/whitbyos/work-plans/actions";
import { WORKSTREAM_STATUS } from "@/whitbyos/lib/workstream-status";
import type { WorkstreamEdit } from "@/whitbyos/lib/work-plans";

/**
 * WP.19 — Edit Work Stream.
 *
 * Narrower than WP.18 at 480px, and deliberately short: SRS §6.6.4 gives a
 * Work Stream an owner, priority, dependencies and progress, but the reference
 * edits only its name and status here. Those stay as they were rather than
 * being quietly cleared by a dialog that never showed them.
 *
 * Target date is the exception, and it is here against the reference. The
 * Report Timeline (15.3c) lays each stream out against it, and no screen in
 * the product could set it — so it was null on every stream that existed and
 * the Timeline drew every lane as "no dates set". A column the whole of one
 * screen depends on has to be reachable from somewhere.
 *
 * A client component only so Remove asks first — it takes the stream's tasks
 * with it, which is more than the dialog's own sentence can undo.
 */
export function EditWorkstreamDialog({
  planId,
  stream,
  closeHref,
  error,
}: {
  planId: string;
  /** Absent when the dialog is opened to add a Work Stream rather than edit one. */
  stream: WorkstreamEdit | null;
  closeHref: string;
  error?: string;
}) {
  const selected = stream ? (stream.blocked ? "blocked" : stream.status) : "not_started";

  return (
    <Modal
      title={stream ? "Edit Work Stream" : "New Work Stream"}
      closeHref={closeHref}
      width={480}
    >
      <form action={saveWorkstream} className="flex flex-col gap-4">
        <input type="hidden" name="plan_id" value={planId} />
        {stream ? <input type="hidden" name="workstream_id" value={stream.id} /> : null}

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Field label="Name" htmlFor="name">
          <input
            id="name"
            name="name"
            required
            defaultValue={stream?.name ?? ""}
            placeholder="What this stream covers"
            className={CONTROL}
          />
        </Field>

        <Field label="Target date" htmlFor="target_date">
          <input
            id="target_date"
            name="target_date"
            type="date"
            defaultValue={stream?.targetDate ?? ""}
            className={CONTROL}
          />
        </Field>

        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={selected}
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          >
            {WORKSTREAM_STATUS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {stream ? (
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {stream.taskCount} task{stream.taskCount === 1 ? "" : "s"} in this Work
            Stream. Removing it removes its tasks and checklists.
          </p>
        ) : (
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Add the tasks once the stream exists, a Work Stream is where they live.
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-4">
          {stream ? (
            // WP.19b, which the export added — a screen with the counts in it,
            // rather than the browser's own sentence.
            <Link
              href={`${closeHref}?stream=${stream.id}&remove=1`}
              scroll={false}
              className="text-[12.5px] no-underline"
              style={{ color: "var(--danger-text)" }}
            >
              Remove Work Stream
            </Link>
          ) : (
            <span />
          )}

          <div className="flex gap-2.5">
            <Button unsized
              href={closeHref}
              variant="secondary"
              className="px-4 py-[9px] text-[13.5px]"
            >
              Cancel
            </Button>
            <Submit unsized
             
              variant="primary"
              className="px-[18px] py-[9px] text-[13.5px]"
            >
              Save
            </Submit>
          </div>
        </div>
      </form>
    </Modal>
  );
}
