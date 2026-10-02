import { Button } from "@/base/components/Button";

/**
 * Screen 2.2a — "<name> workspace created", offering setup or a way past it.
 *
 * Drawn here rather than through `Modal` because this is the one dialog in the
 * module whose contents are centred under a mark: `Modal` lays its header out
 * as a row with the close control on the right, and there is no close control
 * here — Skip for now is the way out, which is the condition for having none.
 * Everything else follows the reference's own numbers.
 *
 * Both actions are links. The dialog is held in the URL like every other one
 * in Whitby, so it survives a refresh and neither button needs client state.
 */
export function WorkspaceCreatedDialog({
  clientName,
  setUpHref,
  skipHref,
}: {
  clientName: string;
  setUpHref: string;
  skipHref: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${clientName} workspace created`}
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: "rgba(55,53,47,.45)" }}
    >
      <div
        className="flex w-full flex-col items-center gap-4 rounded-card bg-surface p-8 text-center"
        style={{ maxWidth: 460, boxShadow: "0 12px 40px rgba(15,15,15,.18)" }}
      >
        {/* The one green mark in the module. Both colours are the success pill's
            own, which is where the reference takes them from. */}
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[12px] text-[20px]"
          style={{ background: "#d6ecd8", color: "#1c7a52" }}
        >
          ✓
        </div>

        <h2 className="text-[19px] font-bold" style={{ margin: 0, color: "var(--ink)" }}>
          &ldquo;{clientName}&rdquo; workspace created
        </h2>

        <p
          className="text-[13.5px] leading-[1.6]"
          style={{ margin: 0, color: "rgba(55,53,47,.6)" }}
        >
          Set up Client Portal access, authorized users and additional members now,
          or skip and do it later from the workspace&rsquo;s Settings.
        </p>

        <div className="flex w-full flex-col gap-2">
          <Button unsized href={setUpHref} variant="primary" className="px-4 py-2.5 text-[13.5px]">
            Set up now
          </Button>
          <Button unsized href={skipHref} variant="secondary" className="px-4 py-2.5 text-[13.5px]">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
