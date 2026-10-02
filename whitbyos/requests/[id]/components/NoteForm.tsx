import { Button } from "@/base/components/Button";
import { addRequestNote } from "@/whitbyos/requests/actions";

/**
 * 3.3n's Notes.
 *
 * Visibility is asked for on the note rather than assumed, because
 * `whitbyos_notes` carries it and §6.11 distinguishes what the team writes for
 * itself from what a client can see. Defaulting to internal is the safe way
 * round: a note meant for the client can be made visible, but one accidentally
 * shown cannot be unseen.
 */
export function NoteForm({ requestId }: { requestId: string }) {
  return (
    <form
      action={addRequestNote}
      className="mb-4 overflow-hidden rounded-[12px] border"
      style={{
        borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(31,72,125,.04)",
      }}
    >
      <input type="hidden" name="request_id" value={requestId} />

      <div className="px-4 pt-3.5">
        <textarea
          name="body"
          required
          placeholder="Enter note…"
          className="min-h-[80px] w-full resize-y border-none bg-transparent text-[13.5px] leading-[1.55] outline-none placeholder:text-[rgba(55,53,47,0.35)]"
        />
      </div>

      <div
        className="flex items-center justify-between gap-3 border-t px-4 py-3"
        style={{ borderColor: "var(--chrome-line)", background: "var(--surface-soft)" }}
      >
        <label
          className="flex items-center gap-2 text-[12.5px]"
          style={{ color: "var(--text-secondary)" }}
        >
          <input
            type="checkbox"
            name="client_visible"
            className="h-[14px] w-[14px]"
            style={{ accentColor: "var(--accent)" }}
          />
          Visible to the client
        </label>

        <Button unsized type="submit" variant="primary" className="px-4 py-[7px] text-[13px]">
          Add note
        </Button>
      </div>
    </form>
  );
}
