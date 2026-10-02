"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Narrow the rail to one Request.
 *
 * "By Request" only ever answered whether a conversation was filed under some
 * request or other, which on an inbox where most threads are is no filter at
 * all. This is the question people actually ask — what has been said about the
 * Ontario permit — and it is the same question the Request's own page answers
 * from the other side.
 *
 * Only Requests that have a conversation are offered: a list of every request
 * in the workspace, most of them leading to an empty rail, is a longer way of
 * finding out that nothing was said.
 */
export function RequestFilter({
  value,
  options,
}: {
  value: string;
  options: { id: string; title: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (options.length === 0) return null;

  return (
    <select
      value={value}
      aria-label="Filter by Request"
      onChange={(event) => {
        const next = new URLSearchParams(params.toString());
        if (event.target.value) next.set("request", event.target.value);
        else next.delete("request");
        // The open thread may not survive the filter it is being read under.
        next.delete("thread");
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
      className="w-full rounded-control border border-line px-2.5 py-[7px] text-[12.5px]"
      style={{ background: "var(--chat-field)", color: "var(--ink)" }}
    >
      <option value="">Any Request</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.title}
        </option>
      ))}
    </select>
  );
}
