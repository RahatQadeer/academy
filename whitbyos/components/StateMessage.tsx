import { cn } from "@/base/lib/cn";

/**
 * The centred empty and error states, as the reference draws them.
 *
 * They are not the same block with a colour swapped — the export gives each its
 * own size. An empty state is an invitation: a 56px accent tile, a 17px
 * heading, and one primary action. An error is an interruption: a larger 64px
 * tile in the danger colours, a 19px heading, and a pair of buttons. Neither
 * sits in a bordered card; both centre in the space the list would have filled.
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
    <div className="flex min-h-[60vh] items-center justify-center">
      <div
        className={cn(
          "flex flex-col items-center gap-3.5 text-center",
          danger ? "max-w-[340px]" : "max-w-[380px]",
        )}
      >
        <div
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
