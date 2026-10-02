import type { ProgramRateRow } from "@/partner-center/earnings/types";

export function ProgramRatesCard({ programs }: { programs: ProgramRateRow[] }) {
  return (
    <div className="pa-partner-card p-6">
      <div
        className="mb-4 text-[13.5px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Program rates
      </div>
      <ul className="m-0 list-none p-0">
        {programs.map((program) => (
          <li
            key={program.key}
            className="flex items-center justify-between py-2"
          >
            <span
              className="text-[13.5px]"
              style={{
                color: program.active ? "var(--ink)" : "var(--text-tertiary)",
              }}
            >
              {program.label}
            </span>
            <span
              className="text-[13.5px] font-semibold"
              style={{
                color: program.active ? "var(--ink)" : "var(--text-tertiary)",
                fontWeight: program.active ? 600 : 400,
              }}
            >
              {program.rateLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
