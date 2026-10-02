"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/base/lib/cn";

export const WORKSPACE_PARAM = "client";

/**
 * "All Workspaces", which Professional 5 v2 adds to the Messages rail
 * and above the Updates feed.
 *
 * It filters by client rather than by workspace, whatever the label says: the
 * options the reference lists are client names, and a workspace is the firm
 * everything here already belongs to.
 */
export function WorkspaceFilter({
  clients,
  variant = "page",
  className,
}: {
  clients: { id: string; name: string }[];
  /** The rail draws it full width and smaller; the page draws it inline. */
  variant?: "page" | "rail";
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(WORKSPACE_PARAM) ?? "";

  function onChange(next: string) {
    const query = new URLSearchParams(params.toString());
    if (next) query.set(WORKSPACE_PARAM, next);
    else query.delete(WORKSPACE_PARAM);

    // Whatever is open belongs to the workspace being left. Keeping the thread
    // in the URL would leave the reader looking at the one conversation the
    // filter beside it has just said to hide.
    query.delete("thread");

    const search = query.toString();
    router.push(search ? `${pathname}?${search}` : pathname);
  }

  const rail = variant === "rail";

  return (
    <select
      aria-label="Filter by workspace"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "cursor-pointer rounded-[6px] border border-line-strong font-sans",
        rail
          ? "mb-3 w-full px-2.5 py-1.5 text-[12px]"
          : "px-3 py-2 text-[13.5px]",
        className,
      )}
      style={{ background: "var(--surface)", color: "var(--ink)" }}
    >
      <option value="">All Workspaces</option>
      {clients.map((client) => (
        <option key={client.id} value={client.id}>
          {client.name}
        </option>
      ))}
    </select>
  );
}
