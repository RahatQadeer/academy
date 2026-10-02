"use client";

import { cn } from "@/base/lib/cn";
import { pcType } from "@/partner-center/lib/typography";

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-[15px] w-[15px] shrink-0 accent-[var(--accent)]"
      />
      <span
        className={cn(pcType.subtitle, "leading-[1.5]")}
        style={{ color: "var(--text-secondary)" }}
      >
        {children}
      </span>
    </label>
  );
}
