"use client";

import { useMemo, useState } from "react";
import type { Recipient } from "@/whitbyos/lib/messages";
import { sideOfKind, type GroupSide } from "@/whitbyos/lib/message-group-side";

const GROUPS: { kind: Recipient["kind"]; label: string }[] = [
  { kind: "teammate", label: "Your team" },
  { kind: "contact", label: "Client members and contacts" },
  { kind: "provider", label: "Providers" },
];

const ROLE_WORDS: Record<string, string> = {
  primary_member: "Member",
  additional_member: "Additional member",
  authorized_user: "Authorized user",
  dependent: "Dependent",
  primary_contact: "Primary contact",
  billing_contact: "Billing contact",
  decision_maker: "Decision-maker",
  authorized_representative: "Authorized representative",
};

/**
 * Who goes on a group — with client and provider kept apart.
 *
 * Checking anyone on one outside side greys out the other. Teammates stay
 * free on either. `lockedSide` is for an existing group that already has a
 * side: the opposite list is not offered at all.
 */
export function GroupPeoplePicker({
  recipients,
  multiple = true,
  lockedSide = null,
}: {
  recipients: Recipient[];
  /** Checkboxes for a group; a single radio for a one-to-one start. */
  multiple?: boolean;
  /** Side already on the thread — the opposite kind is hidden. */
  lockedSide?: GroupSide | null;
}) {
  const [picked, setPicked] = useState<string[]>([]);

  const activeSide = useMemo(() => {
    if (lockedSide) return lockedSide;
    for (const value of picked) {
      const kind = value.split(":")[0];
      const side = sideOfKind(kind);
      if (side) return side;
    }
    return null;
  }, [picked, lockedSide]);

  const visible = useMemo(() => {
    if (!lockedSide) return recipients;
    return recipients.filter((person) => {
      const side = sideOfKind(person.kind);
      return !side || side === lockedSide;
    });
  }, [recipients, lockedSide]);

  function toggle(value: string, checked: boolean) {
    if (!multiple) {
      setPicked(checked ? [value] : []);
      return;
    }
    setPicked((current) => {
      const next = checked
        ? [...current, value]
        : current.filter((row) => row !== value);
      // One outside side at a time — drop the other if it somehow remained.
      const side = sideOfKind(value.split(":")[0]);
      if (!side || !checked) return next;
      return next.filter((row) => {
        const other = sideOfKind(row.split(":")[0]);
        return !other || other === side;
      });
    });
  }

  if (visible.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
        No one to add yet. Contacts linked to a client, providers, and teammates
        appear here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex max-h-[220px] flex-col overflow-auto">
        {GROUPS.map((section) => {
          const people = visible.filter((person) => person.kind === section.kind);
          if (people.length === 0) return null;

          const sectionSide = sideOfKind(section.kind);
          const blocked = Boolean(activeSide && sectionSide && sectionSide !== activeSide);

          return (
            <div key={section.kind} className="mb-2 last:mb-0">
              <span
                className="mb-1 block px-1 text-[11px] font-semibold uppercase tracking-[.05em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {section.label}
              </span>

              {people.map((person) => {
                const value = `${person.kind}:${person.id}`;
                const disabled = blocked;

                return (
                  <label
                    key={value}
                    className="flex items-center gap-2.5 rounded-control px-1 py-2 text-[13.5px] hover:bg-[var(--surface-soft)]"
                    style={disabled ? { opacity: 0.45 } : undefined}
                  >
                    <input
                      type={multiple ? "checkbox" : "radio"}
                      name="contact_id"
                      value={value}
                      disabled={disabled}
                      checked={picked.includes(value)}
                      onChange={(event) => toggle(value, event.target.checked)}
                      className="h-[15px] w-[15px]"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <PickerFace name={person.name} photo={person.photo} size={26} />
                    <span className="min-w-0 flex-1 truncate">{person.name}</span>
                    {saysWho(person) ? (
                      <span
                        className="shrink-0 text-[11.5px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {saysWho(person)}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>

      {activeSide && !lockedSide ? (
        <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {activeSide === "client"
            ? "Providers are off this list while a client contact is selected."
            : "Client contacts are off this list while a provider is selected."}
        </p>
      ) : null}
    </div>
  );
}

function saysWho(person: Recipient) {
  const role = person.role && person.role !== "provider" ? ROLE_WORDS[person.role] : null;
  return [person.detail, role].filter(Boolean).join(" · ") || null;
}

function PickerFace({
  name,
  photo,
  size = 30,
}: {
  name: string;
  photo?: string | null;
  size?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{
        background: "var(--avatar-tan-bg)",
        color: "var(--avatar-tan-fg)",
        height: size,
        width: size,
        fontSize: Math.round(size * 0.36),
      }}
      aria-hidden
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("")
      )}
    </span>
  );
}
