"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { Select } from "@/partner-center/components/Select";
import { TeamModal } from "@/partner-center/team/components/TeamModal";
import {
  setPrimaryContact,
  updateTeamMember,
} from "@/partner-center/team/lib/actions";
import {
  ACCESS_LEVELS,
  PREFERRED_CONTACT_METHODS,
  SALUTATION_OPTIONS,
  TEAM_FUNCTIONS,
} from "@/partner-center/team/lib/labels";
import type { TeamMemberRow } from "@/partner-center/team/types";
import { RemoveMemberConfirm } from "@/partner-center/team/components/RemoveMemberConfirm";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

export function EditMemberModal({
  member,
  onClose,
}: {
  member: TeamMemberRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const [role, setRole] = useState(
    member.roleTitle === "—" ? "" : member.roleTitle,
  );
  const [salutation, setSalutation] = useState(member.salutation ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [preferred, setPreferred] = useState(member.preferredContactMethod || "");
  const [fn, setFn] = useState(String(member.function || "referral_contact"));
  const [access, setAccess] = useState(String(member.accessLevel || "standard"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function onSave() {
    setPending(true);
    setError(null);
    const result = await runAction(
      () =>
        updateTeamMember({
          member_id: member.id,
          function: fn,
          access_level: access,
          role_title: role,
          salutation,
          phone,
          preferred_contact_method: preferred,
        }),
      { onValidationError: setError, onRetry: () => void onSave() },
    );
    setPending(false);
    if (result.error) return;
    router.refresh();
    onClose();
  }

  async function onSetPrimary() {
    setPending(true);
    setError(null);
    const result = await runAction(
      () => setPrimaryContact({ member_id: member.id }),
      { onValidationError: setError, onRetry: () => void onSetPrimary() },
    );
    setPending(false);
    if (result.error) return;
    router.refresh();
    onClose();
  }

  if (confirmRemove) {
    return (
      <RemoveMemberConfirm
        member={member}
        onClose={() => setConfirmRemove(false)}
        onRemoved={onClose}
      />
    );
  }

  return (
    <TeamModal
      title="Edit team member"
      description={`${member.name} — ${member.email}`}
      onClose={onClose}
      width={460}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            className="border-0 bg-transparent p-0 text-[13.5px] font-medium"
            style={{ color: "var(--danger-fg)", cursor: "pointer" }}
            onClick={() => setConfirmRemove(true)}
            disabled={pending}
          >
            Remove from team
          </button>
          <div className="flex gap-2.5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void onSave()}
              disabled={pending}
            >
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      }
    >
      <Input
        label="Role / title"
        name="role_title"
        value={role}
        onChange={(event) => setRole(event.target.value)}
        placeholder="e.g. Business Development"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Salutation"
          name="salutation"
          value={salutation}
          onChange={(event) => setSalutation(event.target.value)}
        >
          {SALUTATION_OPTIONS.map((option) => (
            <option key={option || "none"} value={option}>
              {option || "—"}
            </option>
          ))}
        </Select>
        <Input
          label="Phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="(555) 010-2938"
        />
      </div>
      <Select
        label="Preferred contact method"
        name="preferred_contact_method"
        value={preferred}
        onChange={(event) => setPreferred(event.target.value)}
      >
        <option value="">—</option>
        {PREFERRED_CONTACT_METHODS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
      <fieldset className="m-0 border-0 p-0">
        <legend
          className="mb-2.5 text-[12.5px] font-medium uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Contact function
        </legend>
        <div className="space-y-2">
          {TEAM_FUNCTIONS.map((item) => {
            const selected = fn === item.value;
            return (
              <label
                key={item.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5"
                style={{
                  border: selected
                    ? "1.5px solid var(--accent)"
                    : "1px solid var(--border)",
                  background: selected ? "rgba(35,131,226,0.04)" : "white",
                }}
              >
                <input
                  type="radio"
                  name="contact_function"
                  value={item.value}
                  checked={selected}
                  onChange={() => {
                    setFn(item.value);
                    if (item.value === "read_only") setAccess("read_only");
                  }}
                  className="accent-[var(--accent)]"
                />
                <span className="text-[14px]" style={{ color: "var(--ink)" }}>
                  {item.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <Select
        label="Partner Center access"
        name="access_level"
        value={access}
        onChange={(event) => setAccess(event.target.value)}
      >
        {ACCESS_LEVELS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
      {!member.isPrimary ? (
        <button
          type="button"
          className="border-0 bg-transparent p-0 text-[13.5px] font-medium"
          style={{ color: "var(--accent)", cursor: "pointer" }}
          onClick={() => void onSetPrimary()}
          disabled={pending}
        >
          Set as primary contact
        </button>
      ) : (
        <p className="m-0 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          This person is the primary contact.
        </p>
      )}
      <FormError message={error} />
    </TeamModal>
  );
}
