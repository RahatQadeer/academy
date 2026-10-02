import Link from "next/link";
import { cn } from "@/base/lib/cn";

/**
 * The full-screen wizard frame the Create Work Plan flow uses (WP.3 onward):
 * a back control on the left, the numbered steps in the middle, and an equal
 * spacer on the right so the steps sit centred however long the back label is.
 *
 * The step list is not fixed. WP.3 shows five, because Build with Whitby has a
 * configure and a generate step; Start from Scratch shows three. Each screen
 * passes its own rather than the frame assuming one path.
 */
export function WizardChrome({
  steps,
  current,
  backHref,
  backLabel = "Cancel",
  children,
}: {
  steps: string[];
  /** 0-based. Steps before it read as done, the rest as still to come. */
  current: number;
  backHref: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    // The bar is white and the body is the canvas everything else in the
    // product sits on. A wizard drawn entirely in white gives its cards no
    // edges, so the panels read as paragraphs and the page reads as a
    // document rather than a set of choices.
    /* White, like the pages either side of it. Every other screen in the
       product puts its cards on white; the wizard put them on the canvas
       grey, so the one flow somebody walks through on their first day was
       also the one that did not look like the rest. */
    <div className="flex min-h-screen flex-col bg-surface">
      <div className="flex flex-none items-center justify-between border-b border-line bg-surface px-10 py-[18px]">
        <Link
          href={backHref}
          className="flex w-40 items-center gap-3 no-underline"
          style={{ color: "var(--text-secondary)" }}
        >
          <span className="text-[16px]" style={{ color: "var(--text-tertiary)" }}>
            ←
          </span>
          <span className="text-[13.5px] font-medium" style={{ color: "var(--text-muted)" }}>
            {backLabel}
          </span>
        </Link>

        <ol className="flex items-center gap-2.5">
          {steps.map((step, index) => {
            const done = index < current;
            const here = index === current;

            return (
              <li key={step} className="flex items-center gap-2.5">
                {index > 0 ? (
                  <span
                    className="block h-[1.5px] w-9"
                    style={{ background: done || here ? "var(--accent)" : "var(--border)" }}
                  />
                ) : null}

                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px]",
                      done || here
                        ? "bg-accent font-bold text-white"
                        : "border-[1.5px] border-line-strong font-semibold",
                    )}
                    style={done || here ? undefined : { color: "var(--text-quiet)" }}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span
                    className={cn("text-[12.5px]", here ? "font-semibold" : "font-medium")}
                    style={{
                      color: here
                        ? "var(--ink)"
                        : done
                          ? "var(--text-tertiary)"
                          : "var(--text-quiet)",
                    }}
                  >
                    {step}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="w-40" />
      </div>

      {children}
    </div>
  );
}
