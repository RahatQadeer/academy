import { DecideDeletion } from "@/whitbyos/components/DecideDeletion";
import type { DeletionAsk } from "@/client-portal/lib/data/deletions";

/**
 * "Can we delete this?", asked of the client.
 *
 * Nothing is deleted until Accept is pressed here, so this is not a notice
 * about something that happened — it is the thing itself, waiting. Decline
 * leaves the record exactly where it is.
 *
 * Accept is drawn as the destructive one because it is: it is the press that
 * destroys the record, even though the professional asked for it.
 */
export function DeletionAsks({ asks, here }: { asks: DeletionAsk[]; here: string }) {
  if (asks.length === 0) return null;

  return (
    <section className="mb-6 flex flex-col gap-2.5">
      <h2 className="text-[14px] font-semibold">
        Permission to delete ({asks.length})
      </h2>

      {asks.map((ask) => (
        <div
          key={ask.id}
          className="rounded-[10px] border px-4 py-3.5"
          style={{ borderColor: "var(--warning-border)", background: "var(--warning-bg)" }}
        >
          <p className="max-w-[72ch] text-[13.5px] leading-[1.6]">
            Your team would like to delete <strong>{ask.label}</strong>, {ask.what}.
          </p>

          {ask.reason ? (
            <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
              {ask.reason}
            </p>
          ) : null}

          <p className="mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            Nothing has been deleted. It stays exactly as it is until you decide.
          </p>

          <div className="mt-3">
            <DecideDeletion
              requestId={ask.id}
              acceptLabel="Allow deletion"
              declineLabel="Keep it"
            />
          </div>
        </div>
      ))}
    </section>
  );
}
