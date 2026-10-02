import { longDate } from "@/client-portal/lib/format";
import { SectionTitle } from "@/client-portal/components/Surface";
import type { CorrectionRound } from "@/client-portal/types";

/**
 * Every correction this form has already been round, oldest first.
 *
 * The submission itself remembers only the ask currently outstanding — answering
 * one clears the note, and a second overwrites the first — so without this a
 * client who has just corrected a form has no way to check they did what was
 * asked, and a form sent back twice looks exactly like one sent back once.
 *
 * Drawn as a list of closed rounds rather than mixed in with the open one above
 * it. What is being asked for now and what was asked for in March are different
 * kinds of fact, and only one of them needs doing.
 */
export function CorrectionHistory({
  rounds,
  timeZone,
}: {
  rounds: CorrectionRound[];
  timeZone: string;
}) {
  if (rounds.length === 0) return null;

  return (
    <section className="mt-7 max-w-2xl">
      <SectionTitle>
        {rounds.length === 1
          ? "Earlier correction"
          : `Earlier corrections (${rounds.length})`}
      </SectionTitle>

      <ol className="flex flex-col gap-2.5">
        {rounds.map((round, index) => (
          <li
            key={round.id}
            className="rounded-card-cp border border-line bg-surface px-4 py-3"
          >
            <div
              className="mb-1 text-[12px] font-medium uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Round {index + 1}
              {round.askedAt
                ? ` · asked ${longDate(round.askedAt, timeZone)}`
                : ""}
            </div>

            <p className="max-w-[72ch] text-[13.5px] leading-relaxed">
              {round.note ?? "Your team asked for a correction without a note."}
            </p>

            <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--success-fg)" }}>
              Answered {longDate(round.answeredAt, timeZone)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
