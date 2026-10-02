"use client";

import { SubmitPlain } from "@/base/components/Submit";

import { useRef } from "react";
import { removeAvatar, uploadAvatar } from "@/whitbyos/settings/actions";

/**
 * Screen 17's identity block — who you are here, and the photo that says so.
 *
 * It was a bare avatar with two buttons beside it, and then your name typed
 * into a field further down and your role greyed out in a disabled input
 * below that — three places saying one thing, none of them saying it first.
 * The name and the role are read here, at the top, where a profile opens on
 * whose it is; the field below is for changing the name, which is a different
 * act from knowing it.
 *
 * Choosing a file uploads it. The export draws two buttons and no third step,
 * and it is right: picking a photo is the whole intent, and a separate Save
 * only exists to make someone confirm what they already said.
 */
export function PhotoField({
  initials,
  avatarUrl,
  name,
  roleLabel,
  email,
}: {
  initials: string;
  avatarUrl: string | null;
  name: string;
  roleLabel: string;
  email: string;
}) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <div
      id="profile-photo"
      className="mb-7 flex flex-wrap items-center gap-4 rounded-[12px] border px-4 py-4"
      style={{ borderColor: "var(--chrome-line)", background: "var(--surface-soft)" }}
    >
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-[18px] font-bold"
        style={{ background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }}
      >
        {avatarUrl ? (
          // Signed URL on a private bucket, so the optimiser cannot fetch it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover"
          // A Google account photo is served from lh3.googleusercontent.com,
          // which refuses the request when a referrer is sent.
          referrerPolicy="no-referrer"
        />
        ) : (
          initials
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[16px] font-semibold tracking-[-0.2px]">{name}</span>
          <span
            className="shrink-0 rounded-full px-2 py-[2px] text-[10.5px] font-bold uppercase tracking-[0.06em]"
            style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          >
            {roleLabel}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {email}
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <form ref={form} action={uploadAvatar}>
          <input
            type="file"
            name="photo"
            id="photo"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) form.current?.requestSubmit();
            }}
          />
          <label
            htmlFor="photo"
            className="cursor-pointer rounded-control border border-line-strong px-3.5 py-[7px] text-[13px] font-medium"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
          >
            Upload photo
          </label>
        </form>

        <form action={removeAvatar}>
          <SubmitPlain
           
            className="rounded-control border border-line-strong px-3.5 py-[7px] text-[13px] font-medium"
            style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
          >
            Remove
          </SubmitPlain>
        </form>
      </div>
    </div>
  );
}
