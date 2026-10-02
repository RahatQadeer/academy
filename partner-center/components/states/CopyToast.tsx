"use client";

import { useEffect } from "react";

export function CopyToast({
  message,
  onDismiss,
  durationMs = 2200,
}: {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-8 right-14 z-[85] flex items-center gap-2.5 rounded-lg px-[18px] py-3 text-[13.5px] font-medium text-white shadow-[0_6px_20px_rgba(15,15,15,0.2)]"
      style={{ background: "#37352f" }}
      role="status"
    >
      <span style={{ color: "#8fd19e" }}>✓</span>
      {message}
    </div>
  );
}
