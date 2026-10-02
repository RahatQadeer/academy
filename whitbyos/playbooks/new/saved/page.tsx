import Link from "next/link";
import { Button } from "@/base/components/Button";
import { WizardChrome } from "@/whitbyos/components/WizardChrome";
import { getPlaybook } from "@/whitbyos/lib/playbooks";

const LIST = "/whitbyos/playbooks";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * 6.0d — Step 4, saved.
 *
 * The reference writes three different closing sentences, one per path, and
 * the difference matters: a duplicate says the original is unchanged, a
 * save-from-plan says the Work Plan is. Both are the reassurance somebody
 * needs at the exact moment they wonder what they just did to the source.
 */
export default async function PlaybookSavedPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const draftId = one(searchParams?.draft) ?? "";
  const playbook = draftId ? await getPlaybook(draftId) : null;

  if (!playbook) {
    return (
      <WizardChrome steps={STEPS} current={3} backHref={LIST} backLabel="Playbooks">
        <div className="flex flex-1 items-center justify-center px-10 py-12">
          <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            That Playbook is no longer here. <Link href={LIST}>Back to Playbooks</Link>.
          </p>
        </div>
      </WizardChrome>
    );
  }

  const source = playbook.createdFromWorkplan
    ? "the source Work Plan is unchanged"
    : playbook.name.startsWith("Copy of ")
      ? "the original Playbook is unchanged"
      : "ready to use on new Work Plans and Requests";

  return (
    <WizardChrome steps={STEPS} current={3} backHref={LIST} backLabel="Playbooks">
      <div className="flex flex-1 items-center justify-center px-10 py-12">
        <div className="flex max-w-[460px] flex-col items-center gap-3.5 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-[22px] font-bold"
            style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
            aria-hidden
          >
            ✓
          </span>

          <h1 className="text-[22px] font-bold">Playbook saved</h1>

          <p className="max-w-[380px] text-[13.5px] leading-[1.6]" style={{ color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--ink)" }}>{playbook.name}</strong>{" "}
            {playbook.createdFromWorkplan || playbook.name.startsWith("Copy of ")
              ? `is ready to use, ${source}.`
              : `is ${source}.`}
          </p>

          <Button unsized
            href={`${LIST}/${playbook.id}`}
            variant="primary"
            className="px-4 py-[9px] text-[13.5px]"
          >
            View Playbook →
          </Button>
        </div>
      </div>
    </WizardChrome>
  );
}

const STEPS = ["Starting point", "Details", "Build Work Streams", "Save"];
