import { cn } from "@/base/lib/cn";
import { pcType } from "@/partner-center/lib/typography";
import {
  relativeTime,
  staffDisplay,
} from "@/partner-center/messages/lib/format";
import type { PartnerMessage } from "@/partner-center/messages/types";

function UnreadDot({ ring }: { ring?: string }) {
  return (
    <span
      aria-label="Unread"
      title="New message"
      className="h-[9px] w-[9px] shrink-0 rounded-full"
      style={{
        background: "var(--danger-solid)",
        border: ring ? `2px solid ${ring}` : undefined,
      }}
    />
  );
}

function Face({ name, initials, size = 34 }: { name: string; initials: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{
        background: "var(--avatar-blue-bg)",
        color: "var(--avatar-blue-fg)",
        height: size,
        width: size,
        fontSize: Math.round(size * 0.36),
      }}
      title={name}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Left rail inspired by Whitby Messages — Partner Center owned, single support thread. */
export function MessagesListRail({
  messages,
  unreadCount,
}: {
  messages: PartnerMessage[];
  unreadCount: number;
}) {
  const staff = staffDisplay();
  const last = messages[messages.length - 1];
  const preview = last?.body?.trim() || "No messages yet";
  const when = last ? relativeTime(last.sentAt) : "";
  const open = true;
  /* Soft green rail + firmer selected row — matches the prior Messages list look. */
  const railBg = "color-mix(in srgb, var(--module-partner-bg) 42%, white)";
  const surface = open ? "var(--accent-tint)" : railBg;

  return (
    <div
      className="flex w-[344px] shrink-0 flex-col border-r border-line"
      style={{ background: railBg }}
    >
      <div className="px-4 pb-3.5 pt-5">
        <h1 className={pcType.pageFixed}>Messages</h1>
        {unreadCount > 0 ? (
          <p
            className={cn("mt-1.5", pcType.meta)}
            style={{ color: "var(--text-tertiary)" }}
          >
            {unreadCount} unread
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto border-t border-line">
        <div
          className="block border-b border-line px-4 py-3.5"
          style={{
            background: open ? "var(--accent-tint)" : undefined,
            color: "var(--ink)",
          }}
          aria-current="true"
        >
          <div className="flex items-start gap-2.5">
            <span className="relative shrink-0">
              <Face name={staff.name} initials={staff.initials} />
              {unreadCount > 0 ? (
                <span className="absolute -right-px -top-px">
                  <UnreadDot ring={surface} />
                </span>
              ) : null}
            </span>

            <div className="min-w-0 flex-1">
              <div className="mb-[3px] flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "min-w-0 truncate",
                    unreadCount > 0 ? pcType.bodyStrong : pcType.bodyMedium,
                  )}
                >
                  {staff.name}
                </span>
                <span
                  className={cn("shrink-0", pcType.meta)}
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {when}
                </span>
              </div>
              <div
                className={cn("truncate", pcType.label)}
                style={{ color: "var(--text-tertiary)" }}
              >
                {preview}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
