"use client";

import { useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AdminHeaderContext,
} from "@/super-admin/partner-center/components/AdminHeaderContext";

/**
 * Registers this page's title / subtitle into the Super Admin shell top bar
 * when that provider is present. Outside it (Partner Admin shell), renders an
 * inline page title so shared screens do not crash.
 */
export function AdminChrome({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const ctx = useContext(AdminHeaderContext);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!ctx) return;
    ctx.setHeader({ title, subtitle });
    return () => ctx.setHeader(null);
  }, [title, subtitle, ctx?.setHeader]);

  useEffect(() => {
    if (!ctx) return;
    setSlot(ctx.actionSlotRef.current);
  }, [ctx?.actionSlotRef, action]);

  if (!ctx) {
    return (
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-semibold tracking-[-0.3px]">
            {title}
          </h1>
          {subtitle ? (
            <p
              className="mt-1 mb-0 text-[13.5px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    );
  }

  if (!action || !slot) return null;
  return createPortal(action, slot);
}
