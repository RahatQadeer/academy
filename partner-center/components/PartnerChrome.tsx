"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePartnerHeader } from "@/partner-center/components/PartnerHeaderContext";

/**
 * Registers this page's title / subtitle into the shell top bar and portals
 * primary actions into the bar (left of the notification bell).
 *
 * Header updates must run in an effect — setState on PartnerHeaderProvider
 * during PartnerChrome's render is illegal in React.
 */
export function PartnerChrome({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { setHeader, actionSlotRef } = usePartnerHeader();
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    setHeader({ title, subtitle });
    return () => setHeader(null);
  }, [title, subtitle, setHeader]);

  useEffect(() => {
    setSlot(actionSlotRef.current);
  }, [actionSlotRef, action]);

  if (!action || !slot) return null;
  return createPortal(action, slot);
}
