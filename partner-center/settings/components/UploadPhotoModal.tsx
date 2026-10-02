"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/base/components/Avatar";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { TeamModal } from "@/partner-center/team/components/TeamModal";
import { uploadPartnerAvatar } from "@/partner-center/settings/lib/actions";

export function UploadPhotoModal({
  displayName,
  avatarUrl,
  open,
  onClose,
}: {
  displayName: string;
  avatarUrl: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return null;

  function resetAndClose() {
    setPreview(null);
    setFile(null);
    setError(null);
    onClose();
  }

  function onPick(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (next.size > 5 * 1024 * 1024) {
      setError("Photos must be 5 MB or smaller.");
      return;
    }
    const type = next.type.toLowerCase();
    if (type && type !== "image/jpeg" && type !== "image/png" && type !== "image/jpg") {
      setError("Use a JPG or PNG image, at least 200×200px.");
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  async function onSave() {
    if (!file) {
      setError("Choose a photo to upload.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadPartnerAvatar(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
      resetAndClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not upload photo.",
      );
    } finally {
      setPending(false);
    }
  }

  const shown = preview || avatarUrl;

  return (
    <TeamModal
      title="Upload photo"
      onClose={resetAndClose}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={resetAndClose}
            disabled={pending}
            unsized
            className="px-4 py-[9px] text-[13.5px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void onSave()}
            disabled={pending}
            unsized
            className="px-4 py-[9px] text-[13.5px]"
          >
            {pending ? "Saving…" : "Save photo"}
          </Button>
        </>
      }
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files?.[0] ?? null;
          onPick(dropped);
        }}
        className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-[10px] border border-dashed border-[#d9d9d6] bg-[#f7f7f5] px-5 py-9"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <Avatar name={displayName} size={56} />
        )}
        <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
          Drop an image or click to browse
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
      />
      {error ? <FormError message={error} /> : null}
    </TeamModal>
  );
}
