import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { cn } from "@/base/lib/cn";

/**
 * The centred empty and error states, as Whitby draws them.
 *
 * They are not the same block with a colour swapped, and they used to be here:
 * both were a bordered `Card` with centred text, which made "there is nothing
 * here yet" and "this did not load" read as the same event at the same weight.
 *
 * An empty state is an invitation — a 56px accent tile, a 17px heading, one
 * primary action. An error is an interruption — a larger 64px tile in the
 * danger colours, a 19px heading, and room for a pair of buttons. Neither sits
 * in a bordered card now; both centre in the space the list would have filled,
 * which is what makes an empty screen read as deliberate rather than broken.
 */
export function StateMessage({
  glyph,
  title,
  description,
  action,
  tone = "neutral",
}: {
  glyph: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
  const danger = tone === "danger";

  return (
    <div className="flex min-h-[46vh] items-center justify-center">
      <div
        className={cn(
          "flex flex-col items-center gap-3.5 text-center",
          danger ? "max-w-[340px]" : "max-w-[380px]",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "flex items-center justify-center",
            danger
              ? "h-16 w-16 rounded-[16px] text-[22px] font-bold"
              : "h-14 w-14 rounded-[14px] text-[24px]",
          )}
          style={{
            background: danger ? "var(--danger-bg)" : "var(--accent-tint)",
            color: danger ? "var(--danger-fg)" : "var(--accent)",
          }}
        >
          {glyph}
        </div>

        <h2 className={danger ? "text-[19px] font-bold" : "text-[17px] font-semibold"}>
          {title}
        </h2>

        <p
          className={cn("text-[13.5px]", danger ? "leading-[1.5]" : "leading-[1.6]")}
          style={{ color: danger ? "var(--text-muted)" : "var(--text-soft)" }}
        >
          {description}
        </p>

        {action ? (
          <div className={cn("flex gap-2.5", danger ? "" : "mt-1.5")}>{action}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Quiet inline placeholder for a section or tab with nothing in it yet.
 *
 * The difference from `StateMessage` is how much of the screen is empty. A
 * whole screen with nothing on it gets the centred block above; one empty
 * panel among several gets this, because a 46vh invitation inside a card that
 * is one of four on the page shouts about the least important thing there.
 */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[8px] border border-line px-4 py-8 text-center text-[13.5px]"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </div>
  );
}

/**
 * The screen-level empty state.
 *
 * Kept as its own name because every caller passes a title and a body rather
 * than a glyph, and a default glyph per screen is not something a caller should
 * have to invent. `glyph` overrides it.
 */
export function EmptyState({
  title,
  body,
  glyph = "○",
  actionLabel,
  actionHref,
}: {
  title: string;
  body?: string;
  glyph?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <StateMessage
      glyph={glyph}
      title={title}
      description={body ?? ""}
      action={
        actionLabel && actionHref ? (
          <Button href={actionHref} variant="primary">
            {actionLabel}
          </Button>
        ) : undefined
      }
    />
  );
}

export function ErrorState({
  title = "Something went wrong",
  body,
  retryHref,
}: {
  title?: string;
  body: string;
  retryHref?: string;
}) {
  return (
    <StateMessage
      tone="danger"
      glyph="!"
      title={title}
      description={body}
      action={
        retryHref ? (
          <Button href={retryHref} variant="primary">
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

/**
 * Says plainly that a screen is showing sample data and why. Better than an
 * empty page that looks like a bug — the reason is always a named upstream gap.
 */
export function SampleDataNotice({ reason }: { reason: string }) {
  return (
    <Callout tone="warning" title="Sample data" className="mb-5">
      {reason}
    </Callout>
  );
}
