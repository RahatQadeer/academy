import { ACADEMY_INTERESTS, type AcademyInterestId } from "../lib/interests";

export function InterestSelector({
  selected,
  onToggle,
}: {
  selected: AcademyInterestId[];
  onToggle: (id: AcademyInterestId) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ACADEMY_INTERESTS.map((interest) => {
        const active = selected.includes(interest.id);
        return (
          <button
            key={interest.id}
            type="button"
            onClick={() => onToggle(interest.id)}
            aria-pressed={active}
            className="flex min-h-[3.1rem] items-start gap-2.5 rounded-[11px] px-3.5 py-3 text-left text-[13.5px] font-medium leading-snug transition-[border-color,background,box-shadow] duration-150"
            style={{
              border: active ? "1.5px solid var(--accent)" : "1px solid var(--border)",
              background: active ? "var(--accent-tint-mid)" : "var(--surface)",
              color: active ? "var(--accent-hover)" : "var(--ink)",
              boxShadow: active ? "0 4px 14px color-mix(in srgb, var(--accent) 12%, transparent)" : "none",
            }}
          >
            <span
              className="mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px]"
              style={{
                border: active ? "1px solid var(--accent)" : "1px solid var(--border-strong)",
                background: active ? "var(--accent)" : "var(--surface)",
                color: "white",
              }}
            >
              {active ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                  <path
                    d="M2 5.2 4.1 7.2 8 2.8"
                    stroke="white"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <span className="text-pretty">{interest.label}</span>
          </button>
        );
      })}
    </div>
  );
}
