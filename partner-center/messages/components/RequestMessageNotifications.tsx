"use client";

import { useEffect } from "react";

/** Ask once for browser notifications when the partner opens Messages. */
export function RequestMessageNotifications() {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    void Notification.requestPermission().catch(() => {
      /* ignore */
    });
  }, []);

  return null;
}
