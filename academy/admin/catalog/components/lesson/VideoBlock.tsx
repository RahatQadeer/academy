"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/base/lib/supabase/client";
import { isHttpUrl } from "@/academy/lesson-player/utils/curriculum";
import { LessonVideoPlayer } from "./LessonVideoPlayer";

export function VideoBlock({
  programId,
  lessonId,
  videoUrl,
  canUpload,
  disabled,
  onChange,
  onComplete,
}: {
  programId: string;
  lessonId: string;
  videoUrl: string;
  canUpload?: boolean;
  disabled?: boolean;
  onChange: (videoUrl: string) => void;
  onComplete?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [resolved, setResolved] = useState(!videoUrl.trim());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!videoUrl.trim()) {
        setSrc(null);
        setResolved(true);
        return;
      }
      setResolved(false);
      if (isHttpUrl(videoUrl)) {
        if (!cancelled) {
          setSrc(videoUrl.trim());
          setResolved(true);
        }
        return;
      }
      const supabase = createClient();
      const path = videoUrl.replace(/^\/+/, "").replace(/^academy\//, "");
      const { data, error: signedError } = await supabase.storage
        .from("academy")
        .createSignedUrl(path, 60 * 60);
      if (cancelled) return;
      if (signedError || !data?.signedUrl) {
        setSrc(null);
        setResolved(true);
        return;
      }
      setSrc(data.signedUrl);
      setResolved(true);
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [videoUrl]);

  async function onFile(file: File) {
    if (file.size > 120 * 1024 * 1024) {
      setError("Keep the video under 120 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `catalog/${programId}/${lessonId}/video.${ext}`;
      const { error: uploadError } = await supabase.storage.from("academy").upload(path, file, {
        upsert: true,
        contentType: file.type || "video/mp4",
      });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      onChange(path);
    } finally {
      setUploading(false);
    }
  }

  if (!src && !canUpload) {
    if (!resolved && videoUrl.trim()) {
      return (
        <div
          className="aspect-video animate-pulse rounded-[14px]"
          style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
          aria-hidden
        />
      );
    }
    return null;
  }

  return (
    <section className="space-y-3">
      {src ? (
        <LessonVideoPlayer key={src} src={src} onComplete={onComplete} />
      ) : (
        <div
          className="flex min-h-[160px] items-center justify-center rounded-[10px] border border-dashed px-4 text-center text-[13px]"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
        >
          Upload a lesson video. Learners will play it in the course.
        </div>
      )}
      {canUpload ? (
        <div className="flex flex-wrap items-center gap-2">
          <label
            className="inline-flex cursor-pointer rounded-[6px] border px-3 py-1.5 text-[13px] font-medium"
            style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
          >
            {uploading ? "Uploading…" : videoUrl ? "Replace video" : "Upload video"}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              hidden
              disabled={disabled || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onFile(file);
              }}
            />
          </label>
          {videoUrl ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange("")}
              className="text-[13px]"
              style={{ color: "var(--text-tertiary)", background: "transparent", border: "none" }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="text-[13px]" style={{ color: "#c4554d" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
