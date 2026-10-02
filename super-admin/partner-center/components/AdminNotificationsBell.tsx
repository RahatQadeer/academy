"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/base/lib/cn";
import {
  markAdminNotificationReadAction,
  markAllAdminNotificationsReadAction,
} from "@/super-admin/partner-center/actions";
import { formatShortDate } from "@/super-admin/partner-center/lib/format";
import type { AdminNotificationItem } from "@/super-admin/partner-center/lib/notifications/types";

function NotificationRow({
  item,
  onSelect,
}: {
  item: AdminNotificationItem;
  onSelect: (item: AdminNotificationItem) => void;
}) {
  const content = (
    <span
      className={cn(
        "min-w-0 flex-1 px-4 py-4",
        !item.read && "bg-[var(--surface-soft)]",
      )}
    >
      <p className="text-[13.5px] font-medium leading-snug text-pretty">
        {item.title}
      </p>
      {item.body ? (
        <p
          className="mt-1 text-[13px] leading-relaxed text-pretty"
          style={{ color: "var(--text-secondary)" }}
        >
          {item.body}
        </p>
      ) : null}
      <p
        className="mt-1.5 text-[11.5px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {formatShortDate(item.createdAt)}
      </p>
    </span>
  );

  const rowClass =
    "group flex w-full text-left transition-colors hover:bg-[#fafaf9]";

  const unreadAccent = !item.read ? (
    <span className="w-[3px] shrink-0 self-stretch bg-accent" aria-hidden />
  ) : null;

  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        className={cn(rowClass, "border-0 bg-transparent p-0")}
        style={{ color: "var(--ink)" }}
        onClick={() => onSelect(item)}
      >
        {unreadAccent}
        {content}
      </button>
    </li>
  );
}

export function AdminNotificationsBell({
  initialItems,
  initialUnreadCount,
}: {
  initialItems: AdminNotificationItem[];
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [pending, startTransition] = useTransition();
  const [pushPermission, setPushPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    setItems(initialItems);
    setUnreadCount(initialUnreadCount);
  }, [initialItems, initialUnreadCount]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushPermission("unsupported");
      return;
    }
    setPushPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function enablePush() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
  }

  function markRead(id: string) {
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read: true, readAt } : item,
      ),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    startTransition(async () => {
      const result = await markAdminNotificationReadAction({
        notificationId: id,
      });
      if (result.error) {
        setItems(initialItems);
        setUnreadCount(initialUnreadCount);
        return;
      }
      router.refresh();
    });
  }

  function markAllRead() {
    const readAt = new Date().toISOString();
    setItems((current) =>
      current.map((item) => ({
        ...item,
        read: true,
        readAt: item.readAt ?? readAt,
      })),
    );
    setUnreadCount(0);
    startTransition(async () => {
      const result = await markAllAdminNotificationsReadAction();
      if (result.error) {
        setItems(initialItems);
        setUnreadCount(initialUnreadCount);
        return;
      }
      router.refresh();
    });
  }

  function onItemClick(item: AdminNotificationItem) {
    setOpen(false);
    if (item.href) {
      router.push(item.href);
    }
    if (!item.read) markRead(item.id);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center rounded-[8px] border transition-colors",
          open
            ? "border-line-strong bg-[#efefed]"
            : "border-transparent bg-transparent hover:bg-[#efefed]",
        )}
        style={{
          color: "var(--ink)",
          width: 36,
          height: 36,
          position: "relative",
        }}
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            lineHeight: 0,
            position: "relative",
          }}
        >
          <Bell size={20} strokeWidth={1.9} style={{ color: "var(--ink)" }} aria-hidden />
          {unreadCount > 0 ? (
            <span
              aria-live="polite"
              style={{
                position: "absolute",
                top: -3,
                right: -6,
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 20,
                height: 20,
                padding: unreadCount > 9 ? "0 5px" : 0,
                borderRadius: 9999,
                background: "#e03131",
                color: "#ffffff",
                border: "2px solid #ffffff",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                pointerEvents: "none",
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+10px)] z-50 flex w-[380px] min-w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[10px] bg-surface shadow-[0_12px_40px_rgba(15,15,15,0.08)]"
          style={{
            border: "1px solid var(--border)",
            maxHeight: "calc(100vh - 5.5rem)",
          }}
        >
          <div
            className="flex min-h-[48px] shrink-0 items-center justify-between gap-4 border-b px-4 py-3"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="shrink-0 text-[14px] font-semibold">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="shrink-0 whitespace-nowrap border-0 bg-transparent p-0 text-[13px] font-medium hover:underline"
                style={{ color: "var(--accent)" }}
                disabled={pending}
                onClick={markAllRead}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {pushPermission === "default" ? (
            <div
              className="shrink-0 border-b px-4 py-3"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-soft)",
              }}
            >
              <p
                className="text-[13px] leading-relaxed text-pretty"
                style={{ color: "var(--text-secondary)" }}
              >
                Get browser alerts when partners submit opportunities.
              </p>
              <button
                type="button"
                className="mt-2 border-0 bg-transparent p-0 text-[13px] font-medium hover:underline"
                style={{ color: "var(--accent)" }}
                onClick={() => void enablePush()}
              >
                Enable push notifications
              </button>
            </div>
          ) : null}

          {items.length === 0 ? (
            <p
              className="px-4 py-8 text-center text-[13px]"
              style={{ color: "var(--text-secondary)" }}
            >
              No notifications yet.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onSelect={onItemClick}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
