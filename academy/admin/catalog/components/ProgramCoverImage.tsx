"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/base/lib/supabase/client";
import { isHttpUrl } from "@/academy/lesson-player/utils/curriculum";
import { CoverImageCropDialog } from "./CoverImageCropDialog";

type PendingCrop = {
  objectUrl: string;
  fileName: string;
};

function withCacheBust(url: string, token: number) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${token}`;
}

export function useProgramCover({
  programId,
  coverImageUrl,
  disabled,
  onChange,
  onPersist,
}: {
  programId: string;
  coverImageUrl: string;
  disabled?: boolean;
  onChange: (coverImageUrl: string) => void;
  onPersist?: (coverImageUrl: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCrop, setPendingCrop] = useState<PendingCrop | null>(null);
  /** Bumps after replace so same storage path still reloads the new file. */
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    return () => {
      if (pendingCrop?.objectUrl) URL.revokeObjectURL(pendingCrop.objectUrl);
    };
  }, [pendingCrop]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!coverImageUrl.trim()) {
        if (!previewUrlRef.current) setSrc(null);
        return;
      }
      if (isHttpUrl(coverImageUrl)) {
        if (!previewUrlRef.current) {
          setSrc(refreshToken > 0 ? withCacheBust(coverImageUrl.trim(), refreshToken) : coverImageUrl.trim());
        }
        return;
      }
      const supabase = createClient();
      const path = coverImageUrl.replace(/^\/+/, "").replace(/^academy\//, "");
      const { data, error: signedError } = await supabase.storage
        .from("academy")
        .createSignedUrl(path, 60 * 60);
      if (cancelled) return;
      if (signedError || !data?.signedUrl) {
        if (!previewUrlRef.current) setSrc(null);
        return;
      }
      const next = refreshToken > 0 ? withCacheBust(data.signedUrl, refreshToken) : data.signedUrl;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setSrc(next);
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [coverImageUrl, refreshToken]);

  function clearPendingCrop() {
    setPendingCrop((current) => {
      if (current?.objectUrl) URL.revokeObjectURL(current.objectUrl);
      return null;
    });
  }

  function queueFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB.");
      return;
    }
    setError(null);
    clearPendingCrop();
    setPendingCrop({
      objectUrl: URL.createObjectURL(file),
      fileName: file.name,
    });
  }

  async function persistCoverUrl(url: string) {
    if (!onPersist) return true;
    const result = await onPersist(url);
    if (!result.ok) {
      setError(result.message ?? "Cover uploaded but could not be saved. Try Save draft.");
      return false;
    }
    return true;
  }

  async function uploadBlob(blob: Blob) {
    setUploading(true);
    setError(null);
    const localPreview = URL.createObjectURL(blob);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = localPreview;
    setSrc(localPreview);
    clearPendingCrop();
    try {
      const supabase = createClient();
      const path = `catalog/${programId}/cover.jpg`;
      const { error: uploadError } = await supabase.storage.from("academy").upload(path, blob, {
        upsert: true,
        contentType: "image/jpeg",
        cacheControl: "0",
      });
      if (uploadError) {
        setError(uploadError.message);
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = null;
        }
        setRefreshToken(Date.now());
        return;
      }
      onChange(path);
      await persistCoverUrl(path);
      setRefreshToken(Date.now());
    } finally {
      setUploading(false);
    }
  }

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      disabled={disabled || uploading || Boolean(pendingCrop)}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) queueFile(file);
      }}
    />
  );

  async function remove() {
    setError(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSrc(null);
    onChange("");
    if (onPersist) {
      setUploading(true);
      try {
        await persistCoverUrl("");
      } finally {
        setUploading(false);
      }
    }
  }

  const cropDialog =
    pendingCrop && !disabled ? (
      <CoverImageCropDialog
        imageSrc={pendingCrop.objectUrl}
        pending={uploading}
        onCancel={clearPendingCrop}
        onConfirm={(blob) => uploadBlob(blob)}
      />
    ) : null;

  return {
    src,
    uploading,
    error,
    disabled: Boolean(disabled),
    inputId,
    input,
    remove,
    cropDialog,
  };
}

export function ProgramCoverBanner({
  src,
  uploading,
  disabled,
  inputId,
  input,
  onRemove,
  size = "hero",
}: {
  src: string | null;
  uploading: boolean;
  disabled?: boolean;
  inputId: string;
  input: ReactNode;
  onRemove?: () => void;
  size?: "hero" | "preview";
}) {
  if (!src && !uploading) return null;

  const heightClass = size === "preview" ? "h-[140px] sm:h-[240px]" : "h-[160px] sm:h-[240px] lg:h-[320px]";
  const controlsDisabled = Boolean(disabled) || uploading;

  return (
    <div
      className={`relative ${heightClass} w-full shrink-0 overflow-hidden border-b`}
      style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
      aria-busy={uploading || undefined}
    >
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(180deg, transparent 35%, rgba(15,15,15,.4) 100%)" }}
          />
        </>
      ) : null}

      {uploading ? (
        <div
          className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2"
          style={{ background: src ? "rgba(15,15,15,.45)" : "var(--surface-soft)" }}
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              background: "rgba(255,255,255,.94)",
              color: "var(--ink)",
              boxShadow: "0 8px 24px rgba(15,15,15,.18)",
            }}
          >
            <SpinnerIcon size={18} />
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[12px] font-medium"
            style={{
              background: "rgba(255,255,255,.94)",
              color: "var(--ink)",
            }}
          >
            Updating cover…
          </span>
        </div>
      ) : null}

      {!disabled ? (
        <>
          {input}
          <div className="absolute bottom-4 right-4 z-[2] flex items-center gap-2">
            {onRemove && src ? (
              <button
                type="button"
                onClick={onRemove}
                disabled={controlsDisabled}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: "rgba(255,255,255,.5)",
                  background: "rgba(255,255,255,.92)",
                  color: "var(--ink)",
                }}
                title="Remove cover"
                aria-label="Remove cover image"
              >
                <RemoveIcon size={14} />
              </button>
            ) : null}
            <label
              htmlFor={controlsDisabled ? undefined : inputId}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-sm ${
                controlsDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
              style={{
                borderColor: "rgba(255,255,255,.5)",
                background: "rgba(255,255,255,.92)",
                color: "var(--ink)",
                pointerEvents: controlsDisabled ? "none" : undefined,
              }}
              title="Change cover"
              aria-label={uploading ? "Uploading cover" : "Change cover image"}
            >
              {uploading ? <SpinnerIcon /> : <CameraIcon size={15} />}
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ProgramCoverCameraButton({
  uploading,
  disabled,
  inputId,
  input,
  className,
}: {
  uploading: boolean;
  disabled?: boolean;
  inputId: string;
  input: ReactNode;
  className?: string;
}) {
  if (disabled) return null;

  return (
    <span className={className}>
      {input}
      <label
        htmlFor={inputId}
        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] transition-colors hover:bg-black/[0.04]"
        style={{ color: "var(--text-tertiary)" }}
        title="Add cover image"
        aria-label={uploading ? "Uploading cover" : "Upload cover image"}
      >
        {uploading ? <SpinnerIcon /> : <CameraIcon size={16} />}
      </label>
    </span>
  );
}

/** Read-only or preview: banner only when image exists. */
export function ProgramCoverImage({
  programId,
  coverImageUrl,
  disabled,
  onChange,
  className,
}: {
  programId: string;
  coverImageUrl: string;
  disabled?: boolean;
  onChange: (coverImageUrl: string) => void;
  className?: string;
}) {
  const cover = useProgramCover({ programId, coverImageUrl, disabled, onChange });

  return (
    <div className={className}>
      <ProgramCoverBanner {...cover} onRemove={cover.remove} />
      {cover.cropDialog}
    </div>
  );
}

function RemoveIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 3.5l7 7M10.5 3.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M3.5 6.5h2.2L6.8 5h4.4l1.1 1.5h2.2a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3.5 13V8a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

function SpinnerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden className="animate-spin">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
