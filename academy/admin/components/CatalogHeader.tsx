import { Button } from "@/base/components/Button";
import { type ReactNode } from "react";

export function CatalogHeader({
  count,
  trailing,
  allowCreate = true,
}: {
  count: number;
  trailing?: ReactNode;
  /** False for Super Admin — they review the catalog but do not create programs. */
  allowCreate?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-[16px] font-semibold tracking-[-0.2px] text-ink">Catalog</h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {count === 0
            ? allowCreate
              ? "Programs you create appear here before they go live in Explore."
              : "Programs created by Academy Admins and Instructors appear here."
            : `${count.toLocaleString()} program${count === 1 ? "" : "s"} in the Academy catalog.`}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        {trailing}
        {allowCreate ? (
          <Button variant="primary" href="/academy/admin/catalog/new">
            New program
          </Button>
        ) : null}
      </div>
    </div>
  );
}
