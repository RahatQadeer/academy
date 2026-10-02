"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function AdminClickableRow({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <tr
      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
      className="hover:bg-[#fafaf9]"
      onClick={() => router.push(href)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(href);
        }
      }}
      tabIndex={0}
      role="link"
    >
      {children}
    </tr>
  );
}
