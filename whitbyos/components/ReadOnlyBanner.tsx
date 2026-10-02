import Link from "next/link";
import { isWorkspaceReadOnly } from "@/whitbyos/lib/read-only";

/**
 * The one place a person is told the workspace has gone read-only.
 *
 * Above every Whitby screen rather than on the billing page alone, because the
 * refusal can be met anywhere: the button that no longer works is on Requests,
 * or Tasks, or a client. A notice only on the screen they are not looking at
 * would leave the product feeling broken instead of paused.
 *
 * It says what still works, not only what does not. Everything already here
 * stays readable — that is the whole shape of `inactive`, and someone who has
 * just lost their subscription needs to know their data has not gone with it.
 */
export async function ReadOnlyBanner() {
  if (!(await isWorkspaceReadOnly())) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-12 py-2.5 text-[13px]"
      style={{
        background: "var(--warning-bg)",
        borderColor: "var(--border)",
        color: "var(--warning-fg)",
      }}
      role="status"
    >
      <span className="font-semibold">This workspace is read-only.</span>
      <span>
        Its subscription has ended. Everything already here stays readable and
        searchable; nothing new can be created or changed.
      </span>
      <Link
        href="/whitbyos/settings/billing"
        className="font-medium underline underline-offset-2"
        style={{ color: "inherit" }}
      >
        Choose a plan
      </Link>
    </div>
  );
}
