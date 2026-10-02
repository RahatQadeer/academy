export function PartnerAuthStatRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-6 py-[13px]"
      style={{ borderTop: "1px solid rgba(255,255,255,.28)" }}
    >
      <span
        className="text-[13.5px] leading-snug"
        style={{ color: "rgba(255,255,255,.65)" }}
      >
        {label}
      </span>
      <span className="shrink-0 text-[16px] font-semibold text-white">{value}</span>
    </div>
  );
}
