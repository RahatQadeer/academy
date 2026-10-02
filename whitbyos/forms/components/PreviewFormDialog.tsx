import { Button } from "@/base/components/Button";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL_UNSIZED } from "@/whitbyos/components/Field";
import type { FormField } from "@/whitbyos/lib/form-vocab";

/**
 * 20a2's Preview — the form as whoever receives it will meet it.
 *
 * Every control is disabled. This is a look at the thing, not a place to fill
 * it in: typing here would go nowhere, and a form that quietly discards what
 * somebody typed is worse than one that never invited it.
 *
 * Field types with no real control yet — a file upload, with nothing in Whitby
 * writing to storage — show what they will ask for rather than an input that
 * cannot do it.
 */
export function PreviewFormDialog({
  name,
  fields,
  closeHref,
}: {
  name: string;
  fields: FormField[];
  closeHref: string;
}) {
  return (
    <Modal title={`Preview · ${name}`} closeHref={closeHref} width={560}>
      <p className="mb-5 text-[13px] leading-[1.6]" style={{ color: "var(--text-muted)" }}>
        This is how the form reads to whoever receives it. Nothing here can be
        filled in.
      </p>

      {fields.length === 0 ? (
        <p className="py-8 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          No fields yet, add one and the preview will show it.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {fields.map((field) => (
            <div key={field.id} className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium">
                {field.label}
                {field.required ? (
                  <span style={{ color: "var(--danger-text)" }}> *</span>
                ) : null}
              </span>
              <Control field={field} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
          Close
        </Button>
      </div>
    </Modal>
  );
}

function Control({ field }: { field: FormField }) {
  const options = field.options?.length ? field.options : ["Option one", "Option two"];

  switch (field.type) {
    case "long":
      return <textarea disabled rows={3} className={`${CONTROL_UNSIZED} resize-none text-[13.5px]`} />;

    case "date":
      return <input disabled type="date" className={`${CONTROL_UNSIZED} text-[13.5px]`} />;

    case "boolean":
      return (
        <div className="flex gap-4">
          {["Yes", "No"].map((label) => (
            <label key={label} className="flex items-center gap-1.5 text-[13px]">
              <input disabled type="radio" />
              {label}
            </label>
          ))}
        </div>
      );

    case "choice":
      return (
        <div className="flex flex-col gap-1.5">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-[13px]">
              <input disabled type="radio" />
              {option}
            </label>
          ))}
        </div>
      );

    case "checklist":
      return (
        <div className="flex flex-col gap-1.5">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-[13px]">
              <input disabled type="checkbox" />
              {option}
            </label>
          ))}
        </div>
      );

    case "file":
      return (
        <div
          className="rounded-control border border-dashed border-line-strong px-3.5 py-4 text-center text-[12.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          A file, PDF, DOCX, PNG or JPG
        </div>
      );

    default:
      return <input disabled className={`${CONTROL_UNSIZED} text-[13.5px]`} />;
  }
}
