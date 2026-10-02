"use client";

import type { ReactNode } from "react";
import { AdminChrome } from "@/super-admin/partner-center/components/AdminChrome";

/**
 * Registers title / description into the Partner Center Admin shell header.
 * Eyebrow is ignored visually (shell matches Partner Center: title + subtitle only).
 */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <AdminChrome title={title} subtitle={description} action={action} />
  );
}
