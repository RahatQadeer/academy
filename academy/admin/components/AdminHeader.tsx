import { PageHeader } from "@/academy/components/ui";

function AdminBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]"
      style={{
        background: "var(--accent-tint)",
        color: "var(--accent)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent)",
      }}
    >
      Admin
    </span>
  );
}

export function AdminHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2.5">
          <AdminBadge />
          {actions}
        </div>
      }
      className="mb-7"
    />
  );
}
