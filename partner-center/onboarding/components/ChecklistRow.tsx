import Link from "next/link";
import { Button } from "@/base/components/Button";
import type { ChecklistItem } from "@/partner-center/lib/checklist-state";

function CheckIcon({
  done,
  current,
  locked,
}: {
  done: boolean;
  current: boolean;
  locked?: boolean;
}) {
  if (done) {
    return (
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
      >
        <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
          <path
            d="M3.5 9.4L7 12.9L14.5 5.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 rounded-full border-[1.5px]"
      style={{
        borderColor: locked
          ? "var(--border)"
          : current
            ? "var(--accent)"
            : "var(--border-strong)",
        background: locked ? "var(--surface-soft)" : undefined,
      }}
    />
  );
}

export function ChecklistRow({
  item,
  current,
  last,
}: {
  item: ChecklistItem;
  current: boolean;
  last: boolean;
}) {
  const locked = Boolean(item.locked);

  let action: React.ReactNode;
  if (locked) {
    action = (
      <Button
        type="button"
        variant="primary"
        disabled
        className="px-4 py-[7px] text-[13.5px]"
        aria-label={`${item.action} — finish the steps above first`}
      >
        {item.action}
      </Button>
    );
  } else if (item.done && item.id === "agreement") {
    action = (
      <span
        className="text-[13.5px] font-medium"
        style={{ color: "var(--text-tertiary)" }}
      >
        Signed
      </span>
    );
  } else if (current && !item.done) {
    action = (
      <Button href={item.href} variant="primary" className="px-4 py-[7px] text-[13.5px]">
        {item.action}
      </Button>
    );
  } else {
    action = (
      <Link
        href={item.href}
        className="text-[13.5px] font-medium no-underline"
        style={{ color: "var(--accent)" }}
      >
        {item.done && item.action !== "View" && item.action !== "Edit"
          ? "View"
          : item.action}
      </Link>
    );
  }

  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={last ? undefined : { borderBottom: "1px solid var(--border)" }}
    >
      <CheckIcon done={item.done} current={current} locked={locked} />
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold">{item.label}</div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {item.note}
        </div>
      </div>
      {action}
    </div>
  );
}
