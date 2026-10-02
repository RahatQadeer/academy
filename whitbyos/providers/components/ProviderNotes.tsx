import { addProviderNote, deleteProviderNote } from "@/whitbyos/providers/actions";
import { SubmitPlain } from "@/base/components/Submit";
import { AddToggle } from "@/whitbyos/components/AddToggle";
import { shortDate } from "@/whitbyos/lib/format";
import type { ProviderNote } from "@/whitbyos/lib/provider-notes";

/**
 * What the firm knows about this provider, in the order it was learned.
 *
 * Newest first, each with who wrote it and when. Only the person who wrote a
 * note can take it down — not because the others could not be trusted with it,
 * but because a note is somebody's account of something and editing another
 * person's account silently is a different act from correcting your own.
 */
export function ProviderNotes({
  providerId,
  notes,
}: {
  providerId: string;
  notes: ProviderNote[];
}) {
  return (
    <div className="rounded-[10px] border border-line" style={{ background: "var(--surface)" }}>
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.05em]"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-tertiary)",
          background: `color-mix(in srgb, var(--avatar-orange-bg) 38%, var(--surface))`,
        }}
      >
        <span
          aria-hidden
          className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] text-[11px]"
          style={{ background: "var(--avatar-orange-bg)", color: "var(--avatar-orange-fg)" }}
        >
          ✎
        </span>
        Notes
      </div>
      <div className="px-4 py-3.5">

      <div className="mb-4">
      <AddToggle label="Add note">
      <form action={addProviderNote}>
        <input type="hidden" name="provider_id" value={providerId} />
        <textarea
          name="body"
          rows={2}
          required
          placeholder="Anything worth remembering. Internal only."
          className="w-full resize-y rounded-[8px] border px-3 py-2 text-[13px] leading-[1.5] outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
        />
        <div className="mt-2 flex justify-end">
          <SubmitPlain
            className="rounded-[8px] px-3.5 py-[7px] text-[12.5px] font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            Add note
          </SubmitPlain>
        </div>
      </form>
      </AddToggle>
      </div>

      {notes.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Nothing written down yet.
        </p>
      ) : (
        <div className="flex flex-col">
          {notes.map((note, index) => (
            <div
              key={note.id}
              className="py-3"
              style={{
                borderTop: index === 0 ? undefined : "1px solid var(--border)",
              }}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <div className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  {note.authorName} · {shortDate(note.createdAt)}
                </div>
                {note.mine ? (
                  <form action={deleteProviderNote}>
                    <input type="hidden" name="note_id" value={note.id} />
                    <SubmitPlain
                      className="text-[12px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Remove
                    </SubmitPlain>
                  </form>
                ) : null}
              </div>
              <p
                className="whitespace-pre-wrap text-[13px] leading-[1.6]"
                style={{ color: "var(--ink)" }}
              >
                {note.body}
              </p>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
