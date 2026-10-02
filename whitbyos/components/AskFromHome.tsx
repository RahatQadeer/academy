"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

const SIDEBAR_STORAGE_KEY = "pa-sidebar-icon-rail";

/**
 * Home's Ask box: a navigation, not an answer.
 *
 * It used to post the server action that created the thread and called the
 * model, then redirect — so pressing Ask Whitby on Home froze Home for as long
 * as the model took, and the Ask screen arrived with the answer already
 * finished on it. The question is carried across as `?q=` instead and asked on
 * the other side, where there is a conversation to watch it land in.
 */
export function AskFromHome({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <form
      data-tour="ask"
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const question = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        try {
          // Ask has its own rail — close the product sidebar before we land.
          window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");
          window.dispatchEvent(new Event("pa-sidebar-collapse"));
        } catch {
          /* ignore */
        }
        router.push(question ? `/whitbyos/ask?q=${encodeURIComponent(question)}` : "/whitbyos/ask");
      }}
    >
      {children}
    </form>
  );
}
