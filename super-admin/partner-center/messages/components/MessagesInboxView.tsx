"use client";

import Link from "next/link";
import {
  AdminDataNotice,
  AdminLoadError,
} from "@/super-admin/partner-center/components/AdminDataNotice";
import { AdminStatusPill } from "@/super-admin/partner-center/components/AdminStatusPill";
import {
  profileStatusLabel,
  profileStatusTone,
} from "@/super-admin/partner-center/lib/format";
import { useAdminUiPaths } from "@/super-admin/partner-center/lib/admin-ui-paths";
import { ConversationInboxSidebar } from "@/super-admin/partner-center/messages/components/ConversationInboxSidebar";
import { StaffThreadPane } from "@/super-admin/partner-center/messages/components/StaffThreadPane";
import { LiveStaffMessages } from "@/super-admin/partner-center/messages/components/LiveStaffMessages";
import { MarkStaffMessagesRead } from "@/super-admin/partner-center/messages/components/MarkStaffMessagesRead";
import type {
  AdminMessageThread,
  AdminMessageThreadItem,
} from "@/super-admin/partner-center/messages/types";

export function MessagesInboxView({
  items,
  selected,
  configured,
  error,
  liveEnabled,
  sendAction,
}: {
  items: AdminMessageThreadItem[];
  selected: AdminMessageThread | null;
  configured: boolean;
  error?: string;
  liveEnabled: boolean;
  sendAction?: (input: {
    profileId: string;
    body: string;
  }) => Promise<{ error?: string; ok?: boolean }>;
}) {
  const paths = useAdminUiPaths();
  const selectedId = selected?.profileId ?? null;
  const unreadCount = items.filter((item) => item.unreadFromPartner).length;

  return (
    <div className="flex min-h-0 flex-1 p-3">
      {!configured || error ? (
        <div className="pa-partner-card absolute left-3 right-3 top-3 z-10 px-4 py-3">
          <AdminDataNotice configured={configured} />
          {error ? (
            <div className="mt-2">
              <AdminLoadError message={error} retryHref={paths.messages} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="pa-chat-pane flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[16px]"
        style={{
          boxShadow:
            "0 1px 2px rgba(15,15,15,.06), 0 10px 28px -14px rgba(15,15,15,.14)",
        }}
      >
        <div
          className="flex w-[344px] shrink-0 flex-col border-r border-line"
          style={{ background: "var(--surface)" }}
        >
          <ConversationInboxSidebar
            items={items}
            selectedProfileId={selectedId}
            unreadCount={unreadCount}
          />
        </div>

        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          style={{ background: "var(--chat-ground)" }}
        >
          {selected ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div
                className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-7 py-4"
                style={{ background: "var(--surface)" }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[12.5px] font-bold"
                    style={{
                      background: "var(--avatar-tan-bg)",
                      color: "var(--avatar-tan-fg)",
                    }}
                    aria-hidden
                  >
                    {selected.companyName
                      .split(/\s+/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase() ?? "")
                      .join("") || "?"}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-[16px] font-bold">
                      {selected.companyName}
                    </h2>
                    <p
                      className="mt-[3px] truncate text-[12.5px]"
                      style={{ color: "var(--chat-muted)" }}
                    >
                      {selected.contactName}
                      {selected.contactEmail !== "—"
                        ? ` · ${selected.contactEmail}`
                        : ""}
                    </p>
                  </div>
                </div>
                <AdminStatusPill
                  label={profileStatusLabel(selected.status)}
                  tone={profileStatusTone(selected.status)}
                />
              </div>
              <StaffThreadPane
                profileId={selected.profileId}
                messages={selected.messages}
                sendAction={sendAction}
              />
              <MarkStaffMessagesRead
                profileId={selected.profileId}
                messageCount={
                  selected.messages.filter((m) => !m.isStaff).length
                }
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
              <span
                aria-hidden
                className="mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-full"
                style={{
                  background: "var(--accent-tint)",
                  boxShadow: "0 0 0 8px rgba(31,72,125,.04)",
                }}
              >
                <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
                  <path
                    d="M4.5 12.2c0-2.4 1.9-4.4 4.3-4.4h9.4c2.4 0 4.3 2 4.3 4.4v4.3c0 2.4-1.9 4.4-4.3 4.4h-5.3l-4.6 3.4a.7.7 0 0 1-1.1-.6v-2.9a4.4 4.4 0 0 1-2.7-4.1v-4.5Z"
                    fill="var(--accent)"
                    fillOpacity=".16"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M24.8 11.4a4.4 4.4 0 0 1 2.7 4v4.2a4.4 4.4 0 0 1-2.6 4v2.7a.7.7 0 0 1-1.1.6l-3.4-2.5"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <p
                className="text-[20px] font-bold tracking-[-0.2px]"
                style={{ color: "var(--chat-ink)", margin: 0 }}
              >
                Select a conversation
              </p>
              <p
                className="mt-2 max-w-[380px] text-[13.5px] leading-[1.6]"
                style={{ color: "var(--chat-muted)", margin: "8px 0 0" }}
              >
                Choose a partner on the left to read and reply. Partners message
                you from Partner Center → Messages.
              </p>
              {items.length === 0 ? (
                <Link
                  href={paths.partners}
                  className="mt-6 text-[13.5px] font-semibold no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  View partners
                </Link>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <LiveStaffMessages enabled={liveEnabled} profileId={selectedId} />
    </div>
  );
}
