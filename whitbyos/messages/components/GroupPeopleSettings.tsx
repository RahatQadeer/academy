"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { removeParticipant } from "@/whitbyos/messages/actions";
import { AddParticipantDialog } from "@/whitbyos/messages/components/AddParticipantDialog";
import type { Person, Recipient } from "@/whitbyos/lib/messages";

const PERSON_KIND: Record<Person["kind"], string> = {
  teammate: "Your team",
  contact: "Client contact",
  provider: "Provider",
};

/**
 * People on a group — Remove and Add without reloading Messages.
 */
export function GroupPeopleSettings({
  threadId,
  people: initial,
  recipients,
  alreadyKinds,
}: {
  threadId: string;
  people: Person[];
  /** Everybody who could be offered on Add people. */
  recipients: Recipient[];
  alreadyKinds?: string[];
}) {
  const router = useRouter();
  const [people, setPeople] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setPeople(initial);
  }, [initial]);

  function onRemove(person: Person) {
    const key = `${person.participantType}:${person.id}`;
    const previous = people;
    setError(null);
    setPendingId(key);
    setPeople((current) =>
      current.filter(
        (row) => !(row.id === person.id && row.participantType === person.participantType),
      ),
    );

    startTransition(async () => {
      const result = await removeParticipant(key, threadId);
      setPendingId(null);
      if (!result.ok) {
        setPeople(previous);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span
          className="block text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          People on it
          <span className="ml-1.5 font-normal" style={{ color: "var(--text-tertiary)" }}>
            {people.length + 1}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="shrink-0 rounded-control border border-line-strong bg-surface px-3 py-[5px] text-[12.5px] font-medium"
          style={{ color: "var(--ink)" }}
        >
          + Add people
        </button>
      </div>

      {error ? (
        <p className="mb-2 text-[12.5px]" style={{ color: "var(--danger-text)" }}>
          {error}
        </p>
      ) : null}

      {people.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Nobody else is on this conversation yet.
        </p>
      ) : (
        <div
          className="overflow-y-auto rounded-[10px] border"
          style={{ borderColor: "var(--chrome-line)", maxHeight: 232 }}
        >
          {people.map((person) => {
            const key = `${person.participantType}:${person.id}`;
            const busy = pending && pendingId === key;

            return (
              <div
                key={key}
                className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0"
              >
                <span
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold"
                  style={{ background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }}
                  aria-hidden
                >
                  {person.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={person.photo}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    initials(person.name)
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{person.name}</span>
                  <span className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                    {PERSON_KIND[person.kind]}
                  </span>
                </span>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRemove(person)}
                  className="shrink-0 rounded-control px-2.5 py-[5px] text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-soft)] disabled:opacity-50"
                  style={{ color: "var(--danger-text)" }}
                >
                  {busy ? "Removing…" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mb-1 mt-2.5 text-[12px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
        Only these people can see it. Somebody removed keeps what was already
        said to them.
      </p>

      {adding ? (
        <AddParticipantDialog
          threadId={threadId}
          people={recipients}
          alreadyOn={people.map((person) => person.id)}
          alreadyKinds={alreadyKinds ?? people.map((person) => person.kind)}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
