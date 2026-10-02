"use client";

import { OrganizationUrlField } from "@/whitbyos/settings/components/OrganizationUrlField";

/** @deprecated Use OrganizationUrlField. Kept so older imports still compile. */
export function WorkspaceUrlField({ defaultSlug }: { defaultSlug: string }) {
  return <OrganizationUrlField defaultSlug={defaultSlug} showCopy size="settings" />;
}
