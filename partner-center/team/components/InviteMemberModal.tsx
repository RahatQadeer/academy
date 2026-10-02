"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { Select } from "@/partner-center/components/Select";
import { TeamModal } from "@/partner-center/team/components/TeamModal";
import { InviteSentSuccessModal } from "@/partner-center/team/components/InviteSentSuccessModal";
import { inviteTeamMember } from "@/partner-center/team/lib/actions";
import {
  ACCESS_LEVELS,
  PREFERRED_CONTACT_METHODS,
  SALUTATION_OPTIONS,
  TEAM_FUNCTIONS,
} from "@/partner-center/team/lib/labels";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

export function InviteMemberModal({
  companyName,
  onClose,
}: {
  companyName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [salutation, setSalutation] = useState("");
  const [phone, setPhone] = useState("");
  const [preferred, setPreferred] = useState("");
  const [role, setRole] = useState("");
  const [fn, setFn] = useState("referral_contact");
  const [access, setAccess] = useState("standard");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<{
    email: string;
    inviteUrl: string;
    warning?: string | null;
  } | null>(null);

  async function onSend() {
    setPending(true);
    setError(null);
    const result = await runAction(
      () =>
        inviteTeamMember({
          name,
          email,
          salutation,
          phone,
          preferred_contact_method: preferred,
          role_title: role,
          function: fn,
          access_level: access,
        }),
      { onValidationError: setError, onRetry: () => void onSend() },
    );
    setPending(false);
    if (result.error) return;
    router.refresh();
    if (!result.invitePath) {
      onClose();
      return;
    }
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    setSent({
      email: email.trim(),
      inviteUrl: `${origin}${result.invitePath}`,
      warning: result.warning ?? null,
    });
  }

  if (sent) {
    return (
      <InviteSentSuccessModal
        email={sent.email}
        inviteUrl={sent.inviteUrl}
        warning={sent.warning}
        onClose={onClose}
      />
    );
  }

  return (
    <TeamModal
      title="Invite team member"
      description={`They'll receive an email invite to join ${companyName} in the Partner Center.`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={() => void onSend()} disabled={pending}>
            {pending ? "Sending…" : "Send invite"}
          </Button>
        </>
      }
    >
      <Input
        label="Name"
        name="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Alex Rowan"
      />
      <Input
        label="Email address"
        name="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="name@company.com"
        required
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
      <Input
        label="Role / title"
        name="role_title"
        value={role}
        onChange={(event) => setRole(event.target.value)}
        placeholder="e.g. Business Development"
      />
      <Select
        label="Contact function"
        name="function"
        value={fn}
        onChange={(event) => {
          const next = event.target.value;
          setFn(next);
          if (next === "read_only") setAccess("read_only");
        }}
      >
        {TEAM_FUNCTIONS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </Select>
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
      <FormError message={error} />
    </TeamModal>
  );
}
