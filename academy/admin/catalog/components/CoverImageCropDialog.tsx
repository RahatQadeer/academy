"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/base/components/Button";
import { cropCoverImage } from "../lib/cropCoverImage";

/** Wide banner ratio used across overview, preview, and explore cards. */
export const COVER_ASPECT = 16 / 9;

export function CoverImageCropDialog({
  imageSrc,
  pending,
  onCancel,
  onConfirm,
}: {
  imageSrc: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function applyCrop() {
    if (!croppedAreaPixels) return;
    setExporting(true);
    setError(null);
    try {
      const blob = await cropCoverImage(imageSrc, croppedAreaPixels, "image/jpeg");
      onConfirm(blob);
    } catch {
      setError("Could not prepare the cropped image. Try again.");
    } finally {
      setExporting(false);
    }
  }

  const busy = pending || exporting;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cover-crop-title"
    >
      <div
        className="flex w-full max-w-[720px] flex-col overflow-hidden rounded-[12px] border shadow-[0_20px_60px_rgba(15,15,15,.18)]"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 id="cover-crop-title" className="text-[16px] font-semibold" style={{ color: "var(--ink)" }}>
            Crop cover image
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Drag to reposition. Use the slider to zoom. The crop matches the banner learners will see.
          </p>
        </div>

        <div className="relative h-[min(52vh,420px)] bg-[#111]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={COVER_ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="horizontal-cover"
          />
        </div>

        <div className="border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[12px] font-medium" style={{ color: "var(--text-tertiary)" }}>
              Zoom
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              disabled={busy}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="min-w-0 flex-1 accent-[var(--accent,#2383e2)]"
              aria-label="Zoom crop"
            />
          </div>

          {error ? (
            <p className="mt-3 text-[12.5px]" style={{ color: "#c4554d" }}>
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" className="!px-3.5 !py-2 !text-[13px]" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="!px-3.5 !py-2 !text-[13px]"
              disabled={busy || !croppedAreaPixels}
              onClick={() => void applyCrop()}
            >
              {busy ? "Saving…" : "Use cover"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
