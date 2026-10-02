import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { updatePlaybook } from "@/whitbyos/playbooks/actions";
import { PLAYBOOK_CATEGORIES, SHARED_LEVELS } from "@/whitbyos/lib/playbook-vocab";

export function EditPlaybookDialog({
  playbookId,
  values,
  closeHref,
  error,
}: {
  playbookId: string;
  values: {
    name: string;
    category: string | null;
    description: string | null;
    sharedLevel: string | null;
    streamNames: string[];
  };
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Edit Playbook" closeHref={closeHref} width={560}>
      <form action={updatePlaybook} className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <input type="hidden" name="playbook_id" value={playbookId} />

        <Field label="Playbook name" htmlFor="name">
          <input id="name" name="name" required defaultValue={values.name} className={CONTROL} />
        </Field>

        <div className="flex gap-3">
          <Field label="Category" htmlFor="category" className="flex-1">
            <select
              id="category"
              name="category"
              defaultValue={values.category ?? "Relocation"}
              className={`${CONTROL} text-[13.5px]`}
            >
              {PLAYBOOK_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Shared as" htmlFor="shared_level" className="flex-1">
            <select
              id="shared_level"
              name="shared_level"
              defaultValue={values.sharedLevel ?? "private"}
              className={`${CONTROL} text-[13.5px]`}
            >
              {SHARED_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description" htmlFor="description">
          <textarea
            id="description"
            name="description"
            defaultValue={values.description ?? ""}
            className={`${CONTROL} min-h-[72px] resize-y`}
          />
        </Field>

        <Field label="Work Streams, one per line" htmlFor="streams">
          <textarea
            id="streams"
            name="streams"
            defaultValue={values.streamNames.join("\n")}
            className={`${CONTROL} min-h-[110px] resize-y font-mono text-[13px]`}
          />
        </Field>

        <p className="-mt-1 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          A stream keeps its tasks as long as its name is unchanged. Saving
          raises the version.
        </p>

        <div className="mt-1 flex justify-end gap-2.5">
          <Link
            href={closeHref}
            className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={{ color: "var(--ink)" }}
          >
            Cancel
          </Link>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Save Changes
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
