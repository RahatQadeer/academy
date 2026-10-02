import { SubmitPlain } from "@/base/components/Submit";
import { Button } from "@/base/components/Button";
import { Modal } from "@/whitbyos/components/Modal";

/**
 * WP.18b and WP.19b — the confirmation the export added after we asked why
 * there wasn't one.
 *
 * Both are the same dialog at different widths, so they are one component: a
 * danger mark, a question for a heading, a sentence naming exactly what goes,
 * and a destructive button that repeats the verb rather than saying "OK".
 * `detail` is written by the caller because only it knows the counts, and the
 * whole point of this screen is that the counts are stated before the click.
 */
export function ConfirmRemoveDialog({
  title,
  detail,
  confirmLabel,
  action,
  hidden,
  closeHref,
  width = 420,
}: {
  title: string;
  detail: string;
  confirmLabel: string;
  action: (formData: FormData) => void;
  /** Hidden fields the action needs, as name/value pairs. */
  hidden: Record<string, string>;
  closeHref: string;
  width?: number;
}) {
  return (
    <Modal title={title} closeHref={closeHref} width={width} bareHeader>
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px] font-bold"
            style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}
            aria-hidden
          >
            !
          </span>
          <h2 className="text-[17px] font-bold">{title}</h2>
        </div>

        <p className="text-[13px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
          {detail}
        </p>

        <form action={action} className="mt-1 flex justify-end gap-2.5">
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <SubmitPlain
           
            className="inline-flex items-center justify-center rounded-control px-[18px] py-[9px] text-[13.5px] font-medium text-white"
            style={{ background: "var(--danger-text)" }}
          >
            {confirmLabel}
          </SubmitPlain>
        </form>
      </div>
    </Modal>
  );
}
