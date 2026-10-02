import Link from "next/link";

/**
 * Screen 4.5 — Skip this step?
 *
 * The export draws it over the step that asks what kind of work you
 * coordinate. That question lives inside the Organization step here, which is
 * required and cannot be skipped, so the confirmation sits on the one step
 * that does offer a skip: the client workspace. What it says is the same
 * thing, about the thing actually being skipped.
 */
export function SkipStepDialog({
  backHref,
  skipHref,
}: {
  backHref: string;
  skipHref: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{ background: "rgba(55,53,47,.45)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="skip-step-title"
    >
      <div
        className="flex w-full max-w-[400px] flex-col gap-[18px] rounded-[10px] bg-surface p-7"
        style={{ boxShadow: "0 12px 40px rgba(15,15,15,.18)" }}
      >
        <div className="flex flex-col gap-2">
          <h2 id="skip-step-title" className="text-[19px] font-bold">
            Skip this step?
          </h2>
          <p className="text-[13.5px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
            You can always create a workspace later from Clients. Setting
            one up now just gives Whitby somewhere to put your first request.
          </p>
        </div>

        <div className="flex justify-end gap-2.5">
          <Link
            href={backHref}
            className="rounded-control border border-line-strong px-4 py-[9px] text-[14px] font-medium no-underline"
            style={{ color: "var(--ink)" }}
          >
            Go back
          </Link>
          <Link
            href={skipHref}
            className="rounded-control px-4 py-[9px] text-[14px] font-medium text-white no-underline hover:text-white"
            style={{ background: "var(--ink)" }}
          >
            Skip anyway
          </Link>
        </div>
      </div>
    </div>
  );
}
