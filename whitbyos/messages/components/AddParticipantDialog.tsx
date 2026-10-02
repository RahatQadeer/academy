"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { GroupPeoplePicker } from "@/whitbyos/messages/components/GroupPeoplePicker";
import { addParticipant } from "@/whitbyos/messages/actions";
import type { Recipient } from "@/whitbyos/lib/messages";
import type { GroupSide } from "@/whitbyos/lib/message-group-side";
import { sidesInKinds } from "@/whitbyos/lib/message-group-side";

/**
 * Screen 9.4b — adding people to a conversation.
 *
 * Opened from Group settings without changing the URL, so Messages does not
 * reload under the panel. Portaled to `document.body` so it is not clipped
 * inside the settings card.
 */
export function AddParticipantDialog({
  threadId,
  people,
  alreadyOn,
  alreadyKinds,
  closeHref,
  onClose,
  error: initialError,
}: {
  threadId: string;
  people: Recipient[];
  alreadyOn?: string[];
  alreadyKinds?: string[];
  closeHref?: string;
  onClose?: () => void;
  error?: string;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  const on = new Set(alreadyOn ?? []);
  const available = people.filter((person) => !on.has(person.id));
  const sides = sidesInKinds(alreadyKinds ?? []);
  const mixed = sides.has("client") && sides.has("provider");
  const lockedSide: GroupSide | null = mixed
    ? null
    : sides.has("client")
      ? "client"
      : sides.has("provider")
        ? "provider"
        : null;
  const offered = mixed
    ? available.filter((person) => person.kind === "teammate")
    : available;

  function finish() {
    if (onClose) onClose();
    else if (closeHref) router.replace(closeHref);
    router.refresh();
  }

  const dialog = (
    <Modal
      title="Add people"
      closeHref={onClose ? undefined : closeHref}
      onClose={onClose}
      width={440}
      dense
      scrim="rgba(55,53,47,.55)"
    >
      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <p className="mb-[18px] text-[13px]" style={{ color: "var(--text-secondary)" }}>
        They will see this conversation from the point they join, not from the
        beginning.
        {lockedSide === "client"
          ? " Providers cannot join a group that already has a client contact."
          : lockedSide === "provider"
            ? " Client contacts cannot join a group that already has a provider."
            : mixed
              ? " This group already mixes both sides — only teammates can be added until one side is removed."
              : ""}
      </p>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const chosen = new FormData(event.currentTarget)
            .getAll("contact_id")
            .map(String)
            .filter(Boolean);
          setError(null);
          startTransition(async () => {
            const result = await addParticipant(threadId, chosen);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            finish();
          });
        }}
      >
        {offered.length === 0 ? (
          <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Everyone who can join this group is already on it.
          </p>
        ) : (
          <GroupPeoplePicker recipients={offered} multiple lockedSide={lockedSide} />
        )}

        <div className="flex justify-end gap-2.5">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-control border border-line-strong bg-surface px-4 py-[9px] text-[13.5px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              Cancel
            </button>
          ) : closeHref ? (
            <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
              Cancel
            </Button>
          ) : null}
          <button
            type="submit"
            disabled={pending || offered.length === 0}
            className="rounded-control px-[18px] py-[9px] text-[13.5px] font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {pending ? "Adding…" : "Add to conversation"}
          </button>
        </div>
      </form>
    </Modal>
  );

  if (!mounted) return null;
  return createPortal(dialog, document.body);
}
