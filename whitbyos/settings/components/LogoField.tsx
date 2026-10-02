"use client";

import { SubmitPlain } from "@/base/components/Submit";

import { useRef } from "react";
import { removeWorkspaceLogo, uploadWorkspaceLogo } from "@/whitbyos/settings/actions";

/**
 * The workspace's own mark, on Settings, Workspace.
 *
 * A logo could be chosen at onboarding and then never again, which meant a
 * workspace set up in a hurry was stuck with initials for good. Same shape as
 * the profile photo row above it, because it is the same job.
 *
 * Choosing a file uploads it. A separate Save would only exist to make
 * somebody confirm what they already said.
 */
export function LogoField({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  const form = useRef<HTMLFormElement>(null);

  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("") || "PA";

  return (
    <div className="flex items-center gap-4">
      <span
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px] text-[16px] font-bold"
        style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
      >
        {logoUrl ? (
          // Signed URL on a private bucket, so the optimiser cannot fetch it.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-full w-full object-cover"
          // A Google account photo is served from lh3.googleusercontent.com,
          // which refuses the request when a referrer is sent.
          referrerPolicy="no-referrer"
        />
        ) : (
          initials
        )}
      </span>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <form ref={form} action={uploadWorkspaceLogo}>
            <input
              type="file"
              name="logo"
              id="workspace-logo"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) form.current?.requestSubmit();
              }}
            />
            <label
              htmlFor="workspace-logo"
              className="cursor-pointer rounded-control border border-line-strong px-3.5 py-[7px] text-[13px] font-medium"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              Upload logo
            </label>
          </form>

          {logoUrl ? (
            <form action={removeWorkspaceLogo}>
              <SubmitPlain
               
                className="rounded-control border border-line-strong px-3.5 py-[7px] text-[13px] font-medium"
                style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
              >
                Remove
              </SubmitPlain>
            </form>
          ) : null}
        </div>

        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          PNG, JPG or SVG, up to 2MB. It replaces the initials in the sidebar.
        </span>
      </div>
    </div>
  );
}
