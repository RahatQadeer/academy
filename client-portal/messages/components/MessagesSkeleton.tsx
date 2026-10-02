import { cn } from "@/base/lib/cn";

/**
 * Messages, on its way — drawn to the measurements of the real thing.
 *
 * Every piece here stands where its content will: the rail's title, search,
 * Direct/Group switch and chips, rows of a 34px face and two lines, the heading
 * above the conversation, bubbles on both sides, and the composer's box. The
 * point of a skeleton is that the arrival does not move anything.
 */

/** The bubbles, alternating sides the way a conversation does. */
const BUBBLES: { mine: boolean; width: string; lines: number; tight?: boolean }[] = [
  { mine: false, width: "48%", lines: 2 },
  { mine: false, width: "30%", lines: 1, tight: true },
  { mine: true, width: "38%", lines: 1 },
  { mine: false, width: "54%", lines: 3 },
  { mine: true, width: "24%", lines: 1 },
  { mine: true, width: "44%", lines: 2, tight: true },
];

export function ConversationBodySkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy="true">
      <span className="sr-only">Loading messages</span>
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden px-3 py-6 sm:px-7">
        <div className="my-3.5 flex justify-center">
          <Bar width={56} height={20} radius={6} />
        </div>
        {BUBBLES.map((bubble, index) => (
          <div
            key={index}
            className={cn(
              "flex items-end gap-2",
              bubble.tight ? "mt-[2px]" : index === 0 ? "" : "mt-3",
              bubble.mine && "flex-row-reverse",
            )}
          >
            {bubble.mine ? null : (
              <span className="w-6 shrink-0 self-start">
                {bubble.tight ? null : <Bar width={24} height={24} radius={12} />}
              </span>
            )}
            <Bar width={bubble.width} height={26 + bubble.lines * 20} radius={10} />
          </div>
        ))}
      </div>
      <ComposerSkeleton />
    </div>
  );
}

function ComposerSkeleton() {
  return (
    <div
      className="shrink-0 border-t px-3 py-3 sm:px-7 sm:py-4"
      style={{ borderColor: "var(--chat-line)" }}
    >
      <div
        className="flex h-[54px] items-center gap-2.5 rounded-[8px] border px-3"
        style={{ background: "var(--chat-field)", borderColor: "var(--chat-line)" }}
      >
        <Bar width="30%" height={10} />
        <span className="flex-1" />
        <Bar width={24} height={24} radius={6} />
        <Bar width={32} height={32} radius={16} />
      </div>
    </div>
  );
}

export function ThreadHeaderSkeleton() {
  return (
    <div
      className="flex shrink-0 items-center gap-3 border-b px-3 py-3 sm:px-7 sm:py-4"
      style={{ borderColor: "var(--chat-line)", background: "var(--surface)" }}
    >
      <Bar width={34} height={34} radius={17} />
      <div className="flex flex-col gap-2">
        <Bar width={160} height={13} />
        <Bar width={200} height={9} />
      </div>
      <span className="flex-1" />
      <Bar width={34} height={34} radius={8} />
    </div>
  );
}

export function RailSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-hidden>
      <div className="shrink-0 px-4 pb-3.5 pt-5">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Bar width={96} height={14} radius={4} />
            <Bar width={48} height={9} />
          </div>
          <Bar width={30} height={30} radius={8} />
        </div>
        <Bar width="100%" height={33} radius={17} className="mb-3" />
        <Bar width="100%" height={32} radius={8} className="mb-3.5" />
        <div className="flex gap-1.5">
          <Bar width={44} height={27} radius={14} />
          <Bar width={64} height={27} radius={14} />
          <Bar width={86} height={27} radius={14} />
        </div>
      </div>
      <div className="flex flex-col overflow-hidden border-t" style={{ borderColor: "var(--chat-line)" }}>
        {[72, 54, 80, 62, 48].map((width, index) => (
          <div
            key={index}
            className="flex items-start gap-2.5 border-b px-4 py-3.5"
            style={{ borderColor: "var(--chat-line)" }}
          >
            <Bar width={34} height={34} radius={17} />
            <div className="flex min-w-0 flex-1 flex-col gap-[7px] pt-1">
              <div className="flex items-center justify-between gap-3">
                <Bar width={`${width}%`} height={11} />
                <Bar width={30} height={9} />
              </div>
              <Bar width="88%" height={9} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The whole screen, for the route's own loading state. */
export function MessagesScreenSkeleton() {
  return (
    <MessagesFrame>
      <div className={PANEL_CLASS} style={PANEL_SHADOW}>
        <div
          className="flex w-full flex-col lg:w-[344px] lg:shrink-0 lg:border-r"
          style={{ background: "var(--surface)", borderColor: "var(--chat-line)" }}
        >
          <RailSkeleton />
        </div>
        <div className="hidden min-w-0 flex-1 flex-col lg:flex">
          <ThreadHeaderSkeleton />
          <ConversationBodySkeleton />
        </div>
      </div>
    </MessagesFrame>
  );
}

/**
 * The panel: its own ground (`.pa-chat-pane`), set into the page with its
 * corners turned rather than run to the edges — the way Whitby's Messages sits.
 */
export const PANEL_CLASS =
  "pa-chat-pane cp-chat flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[16px]";

export const PANEL_SHADOW = {
  boxShadow: "0 1px 2px rgb(var(--shade-rgb) / .1), 0 10px 28px -14px rgb(var(--shade-rgb) / .22)",
};

/**
 * The page around the panel, shared by the screen and its skeleton so the two
 * cannot disagree about where anything is.
 *
 * Fills the height it is given rather than growing with the conversation: a
 * chat whose composer drifts down the page as the thread gets longer is a
 * document with a form at the end, not a chat. The title lives in the rail, as
 * it does on Whitby's side, so nothing stands between the bar and the panel
 * except a notice when there is one.
 */
export function MessagesFrame({
  notice,
  compactOnMobile = false,
  children,
}: {
  notice?: React.ReactNode;
  /** A conversation is open: below `lg` it takes the whole frame. */
  compactOnMobile?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col p-2 sm:p-3">
      {notice ? (
        <div className={cn("shrink-0", compactOnMobile && "hidden lg:block")}>{notice}</div>
      ) : null}
      {children}
    </div>
  );
}

function Bar({
  width,
  height,
  radius = 4,
  className,
}: {
  width: number | string;
  height: number;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("pa-skeleton block shrink-0", className)}
      style={{ width, height, borderRadius: radius }}
    />
  );
}
