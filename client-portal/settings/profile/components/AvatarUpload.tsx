"use client";

import { Avatar } from "@/base/components/Avatar";
import { uploadAvatar } from "@/client-portal/lib/actions/settings";
import { SubmitButton } from "@/client-portal/components/SubmitButton";

export function AvatarUpload({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl: string | null;
}) {
  return (
    <div className="mb-6 flex items-center gap-4">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-full object-cover"
        />
      ) : (
        <Avatar name={name} size={56} />
      )}
      <form action={uploadAvatar} className="flex items-center gap-2">
        <label
          htmlFor="avatar-file"
          className="cursor-pointer rounded-control border border-line-strong px-3 py-1.5 text-[13.5px] font-medium hover:bg-surface-soft"
        >
          Change photo
        </label>
        <input
          id="avatar-file"
          name="file"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
        <noscript>
          <SubmitButton variant="secondary">Upload</SubmitButton>
        </noscript>
      </form>
    </div>
  );
}
