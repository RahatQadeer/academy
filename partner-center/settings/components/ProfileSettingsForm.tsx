"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/base/components/Avatar";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { savePartnerProfile } from "@/partner-center/settings/lib/actions";
import { UploadPhotoModal } from "@/partner-center/settings/components/UploadPhotoModal";
import type { SettingsProfileData } from "@/partner-center/settings/types";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

const readOnlyClass =
  "bg-[#f7f7f5] text-ink cursor-default focus:outline-none focus:ring-0";

export function ProfileSettingsForm({ data }: { data: SettingsProfileData }) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const [firstName, setFirstName] = useState(data.firstName);
  const [lastName, setLastName] = useState(data.lastName);
  const [title, setTitle] = useState(data.title);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || data.displayName;

  async function onSave() {
    setPending(true);
    setError(null);
    setSuccess(false);
    const result = await runAction(
      () =>
        savePartnerProfile({
          firstName,
          lastName,
          title,
        }),
      { onValidationError: setError, onRetry: () => void onSave() },
    );
    setPending(false);
    if ("error" in result && result.error) return;
    setSuccess(true);
    router.refresh();
  }

  return (
    <>
      <div className="mb-5 rounded-[12px] border border-line bg-white p-6 shadow-[0_1px_2px_rgba(15,15,15,0.04),0_10px_24px_-18px_rgba(45,106,79,0.12)]">
        <div className="mb-5 flex items-center gap-4">
          {data.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.avatarUrl}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar name={displayName} size={56} />
          )}
          <div>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold"
              style={{ color: "var(--accent)" }}
            >
              Upload photo
            </button>
            <p
              className="mt-1 mb-0 text-[12.5px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              JPG or PNG, at least 200×200px
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            name="firstName"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
            maxLength={80}
          />
          <Input
            label="Last name"
            name="lastName"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            maxLength={80}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={data.email}
            readOnly
            tabIndex={-1}
            className={readOnlyClass}
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            value={data.phone}
            readOnly
            tabIndex={-1}
            className={readOnlyClass}
          />
          <div className="sm:col-span-2">
            <Input
              label="Title"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
            />
          </div>
        </div>
      </div>

      {error ? <FormError message={error} /> : null}
      {success ? (
        <p
          className="mb-4 text-[13.5px]"
          style={{ color: "var(--text-secondary)" }}
          role="status"
        >
          Profile changes saved.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={() => void onSave()}
          disabled={pending}
          unsized
          className="px-4 py-[9px] text-[13.5px]"
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <UploadPhotoModal
        displayName={displayName}
        avatarUrl={data.avatarUrl}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </>
  );
}
