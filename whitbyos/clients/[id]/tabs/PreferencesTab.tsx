import { EmptyNote, SectionTitle } from "@/whitbyos/components/EmptyNote";
import type { ClientPreferences } from "@/whitbyos/lib/client-sections";

/**
 * SRS §5.3.3 section 2 — Preferences and Handling: communication preferences,
 * privacy and sensitivity notes, handling instructions, and important dates.
 *
 * Reads `whitbyos_clients.preferences`, the jsonb column already in the schema.
 */
const FIELDS: { key: keyof ClientPreferences; label: string; hint: string }[] = [
  {
    key: "communication",
    label: "Communication preferences",
    hint: "Preferred channel, timing, who to copy",
  },
  {
    key: "privacy",
    label: "Privacy and sensitivity",
    hint: "What must stay restricted, and from whom",
  },
  {
    key: "handling",
    label: "Handling instructions",
    hint: "How this client expects to be worked with",
  },
  {
    key: "importantDates",
    label: "Important dates and context",
    hint: "Anniversaries, travel, recurring commitments",
  },
];

export function PreferencesSection({
  preferences,
}: {
  preferences: ClientPreferences;
}) {
  const filled = FIELDS.filter((field) => preferences[field.key]);

  if (filled.length === 0) {
    return (
      <EmptyNote>
        Nothing recorded yet. Communication preferences, privacy notes, handling
        instructions and important dates live here, and they shape how Whitby and
        the team work with this client.
      </EmptyNote>
    );
  }

  return (
    <>
      <SectionTitle>Preferences and Handling</SectionTitle>
      <div
        className="overflow-hidden rounded-[12px] border"
        style={{
          borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
          background: "var(--surface)",
          boxShadow: "0 1px 2px rgba(31,72,125,.04)",
        }}
      >
        {FIELDS.map((field) => (
          <div
            key={field.key}
            className="border-b px-4 py-3.5 last:border-b-0"
            style={{ borderColor: "var(--chrome-line)" }}
          >
            <div
              className="mb-1 text-[12.5px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {field.label}
            </div>
            <div className="text-[13.5px] leading-[1.55]">
              {preferences[field.key] ?? (
                <span style={{ color: "var(--text-disabled)" }}>{field.hint}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
