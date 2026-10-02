import { Button } from "@/base/components/Button";
import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { Modal } from "@/whitbyos/components/Modal";

/**
 * 2.0a, 4.0a and 5.0d — one dialog, drawn three times.
 *
 * The three are the same screen with different nouns: a question, a line
 * saying what is linked, a panel counting it, and two answers stacked with
 * archive first. Writing it three times would be three chances for the softer
 * answer to end up under the harder one.
 *
 * Archive is the plain button and Delete wears the danger colours, in that
 * order, because the reference puts the reversible answer first — and because
 * a dialog that offers destruction as its top option is one mis-click from
 * being the wrong dialog to have opened.
 */
/**
 * Archive, and only archive.
 *
 * Delete used to sit here, one press away from the row it would destroy. It
 * does not any more: Settings → Archive is the only place anything is deleted,
 * so filing something away and destroying it are two decisions made in two
 * places, and the second one is somewhere you have to go on purpose.
 *
 * `deleteDetail` stays in the shape and is no longer drawn as a button — it is
 * the sentence that says what deleting would take, which is worth reading
 * before archiving something you mean to destroy.
 */
export function ArchiveOrDeleteDialog({
  title,
  lead,
  linked,
  archiveLabel,
  archiveDetail,
  deleteDetail,
  archiveAction,
  hidden,
  closeHref,
}: {
  /** "Archive Hartwell Family?" */
  title: string;
  /** "This client has linked records. Choose what to remove:" */
  lead: string;
  /** The counted panel — "Linked to this client: 3 Requests, …". */
  linked: React.ReactNode;
  /** "Archive this workspace" */
  archiveLabel: string;
  archiveDetail: string;
  deleteDetail: string;
  archiveAction: (formData: FormData) => Promise<void>;
  /** The id both forms post, and anything else they need. */
  hidden: Record<string, string>;
  closeHref: string;
}) {
  const fields = Object.entries(hidden).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));

  return (
    <Modal
      title={title}
      closeHref={closeHref}
      width={460}
      pad="p-7"
      titleSize={18}
      headerGap={14}
      noClose
      scrim="rgba(55,53,47,.4)"
    >
      <div className="flex flex-col gap-3.5">
        <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-muted)" }}>
          {lead}
        </p>

        <div
          className="rounded-[8px] px-3.5 py-3 text-[12.5px] leading-[1.8]"
          style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
        >
          {linked}
        </div>

        <div className="flex flex-col gap-2">
          <form action={archiveAction}>
            {fields}
            <SubmitPlain
             
              className="w-full rounded-control border border-line-strong px-3.5 py-2.5 text-left text-[13.5px] font-medium"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              {archiveLabel}
              <span
                className="mt-0.5 block text-[11.5px] font-normal"
                style={{ color: "var(--text-tertiary)" }}
              >
                {archiveDetail}
              </span>
            </SubmitPlain>
          </form>

        </div>

        {/* Where deleting is done, and what it would take with it. Said here
            so archiving is chosen knowing what the other road looks like. */}
        <p className="text-[12px] leading-[1.6]" style={{ color: "var(--text-tertiary)" }}>
          To delete it for good, archive it first and use Settings → Archive.
          Deleting {deleteDetail.charAt(0).toLowerCase() + deleteDetail.slice(1)}
        </p>

        <div className="flex justify-end">
          <Link
            href={closeHref}
            className="text-[13.5px] no-underline"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancel
          </Link>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The control in each table's 32px lane.
 *
 * The export writes the words "Archive/Delete" into a 32px column, which is
 * narrower than the words — it is a label standing in for a mark. The mark is
 * drawn, and the words it stands for are the title, which is where the
 * reference put them too.
 */
/**
 * The row's way into the dialog above.
 *
 * `glyph` is the reference's own ⋯, and stays the default: five screens draw
 * it that way and none of them should change because one did.
 *
 * `word` draws a bordered button saying Archive instead. The Clients list
 * asked for it after the ⋯ turned out to be unreadable as a control — nothing
 * on the row said that the three dots were Archive, so the one action a client
 * row carries looked like decoration. It sits beside Resend there, which is
 * drawn the same way, so the two read as a pair of actions rather than as a
 * link and a glyph.
 */
export function ArchiveOrDeleteLink({
  href,
  label,
  variant = "glyph",
}: {
  href: string;
  label: string;
  variant?: "glyph" | "word";
}) {
  if (variant === "word") {
    return (
      <Button
        unsized
        href={href}
        variant="secondary"
        className="whitespace-nowrap px-3 py-1.5 text-[12.5px]"
      >
        Archive
      </Button>
    );
  }

  /*
   * Ink, in a button, rather than three pale dots in the margin.
   *
   * At `--text-disabled` on white this was very nearly invisible — the only
   * way to find it was to already know it was there, which is a poor way to
   * reach the one control that archives a client.
   */
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-control border text-[16px] leading-none no-underline transition-colors hover:bg-[var(--surface-soft)]"
      style={{
        borderColor: "var(--border-strong)",
        background: "var(--surface)",
        color: "var(--ink)",
      }}
    >
      ⋯
    </Link>
  );
}
