import { redirect } from "next/navigation";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The workspace list now lives under Settings. Old bookmarks, and any dialog
 * that still closed here, land on that tab with their query intact.
 */
export default function InvoicesRedirect({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}): never {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(searchParams ?? {})) {
    const value = one(raw);
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  redirect(qs ? `/whitbyos/settings/invoices?${qs}` : "/whitbyos/settings/invoices");
}
