"use client";

import Link from "next/link";
import { cn } from "@/base/lib/cn";
import {
  initialsFromName,
  relativeTime,
} from "@/partner-center/messages/lib/format";
import { useAdminUiPaths } from "@/super-admin/partner-center/lib/admin-ui-paths";
import type { AdminMessageThreadItem } from "@/super-admin/partner-center/messages/types";

function previewBody(item: AdminMessageThreadItem): string {
  if (!item.lastBody) return "No messages yet";
  const trimmed = item.lastBody.trim();
  if (trimmed.length <= 72) return trimmed;
  return `${trimmed.slice(0, 69).trimEnd()}…`;
}

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

function Face({ name }: { name: string }) {
  return (
    <span
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[12.5px] font-bold"
      style={{
        background: "var(--avatar-tan-bg)",
        color: "var(--avatar-tan-fg)",
      }}
      title={name}
      aria-hidden
    >
      {initialsFromName(name)}
    </span>
  );
}

export function ConversationList({
  items,
  selectedProfileId,
}: {
  items: AdminMessageThreadItem[];
  selectedProfileId: string | null;
}) {
  const paths = useAdminUiPaths();

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <p
          className="m-0 text-[14px] font-semibold"
          style={{ color: "var(--ink)" }}
        >
          No partners to message
        </p>
        <p
          className="m-0 mt-1.5 text-center text-[12.5px] leading-[1.45]"
          style={{ color: "var(--text-secondary)" }}
        >
          Approved and active partners appear here.
        </p>
        <Link
          href={paths.partners}
          className="mt-4 text-[13px] no-underline"
          style={{ color: "var(--accent)" }}
        >
          View partners
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto border-t border-line">
      {items.map((item) => {
        const active = item.profileId === selectedProfileId;
        const surface = active ? "var(--accent-tint-mid)" : "var(--surface)";
        const when = item.lastSentAt ? relativeTime(item.lastSentAt) : "";

        return (
          <Link
            key={item.profileId}
            href={paths.message(item.profileId)}
            className={cn(
              "block border-b border-line px-4 py-3.5 no-underline transition-colors",
              !active && "hover:bg-[var(--surface-active)]",
            )}
            style={{
              background: active ? "var(--accent-tint-mid)" : undefined,
              color: "var(--ink)",
            }}
          >
            <div className="flex items-start gap-2.5">
              <span className="relative shrink-0">
                <Face name={item.companyName} />
                {item.unreadFromPartner ? (
                  <span className="absolute -right-px -top-px">
                    <UnreadDot ring={surface} />
                  </span>
                ) : null}
              </span>

              <div className="min-w-0 flex-1">
                <div className="mb-[3px] flex items-center justify-between gap-3">
                  <span
                    className="min-w-0 truncate text-[13.5px]"
                    style={{
                      fontWeight: item.unreadFromPartner ? 600 : 500,
                    }}
                  >
                    {item.companyName}
                  </span>
                  <span
                    className="shrink-0 text-[11.5px]"
                    style={{
                      color: item.unreadFromPartner
                        ? "var(--danger-fg)"
                        : "var(--text-tertiary)",
                      fontWeight: item.unreadFromPartner ? 600 : undefined,
                    }}
                  >
                    {when}
                  </span>
                </div>
                <div
                  className="mb-0.5 truncate text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {item.contactName}
                </div>
                <div
                  className="truncate text-[12.5px]"
                  style={{
                    color: "var(--text-tertiary)",
                    fontWeight: item.unreadFromPartner ? 500 : undefined,
                  }}
                >
                  {item.lastSenderName ? `${item.lastSenderName}: ` : ""}
                  {previewBody(item)}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
