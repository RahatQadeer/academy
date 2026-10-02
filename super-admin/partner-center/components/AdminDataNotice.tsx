import Link from "next/link";
import { Callout } from "@/base/components/Callout";

export function AdminDataNotice({ configured }: { configured: boolean }) {
  if (configured) return null;
  return (
    <Callout className="mb-6" tone="warning" title="Database not connected">
      Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to load partner data.
    </Callout>
  );
}

export function AdminLoadError({
  message,
  retryHref,
}: {
  message: string;
  retryHref: string;
}) {
  return (
    <Callout className="mb-6" tone="danger" title="Could not load data">
      <p>{message}</p>
      <Link href={retryHref} className="mt-2 inline-block text-[13px] font-medium">
        Try again
      </Link>
    </Callout>
  );
}
