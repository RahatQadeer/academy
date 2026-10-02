"use client";

import { useEffect, useRef } from "react";
import { parseVideoPlayback } from "@/academy/lib/videoEmbed";
import { LessonMediaFrame } from "./LessonMediaFrame";

function withTrackingParams(kind: "youtube" | "vimeo", src: string) {
  try {
    const url = new URL(src);
    if (kind === "youtube") {
      url.searchParams.set("enablejsapi", "1");
      url.searchParams.set("rel", "0");
      url.searchParams.set("modestbranding", "1");
      if (typeof window !== "undefined") {
        url.searchParams.set("origin", window.location.origin);
      }
    }
    if (kind === "vimeo") {
      url.searchParams.set("api", "1");
    }
    return url.toString();
  } catch {
    return src;
  }
}

export function LessonVideoPlayer({
  src,
  title = "Lesson video",
  onComplete,
}: {
  src: string;
  title?: string;
  /** Called when the learner finishes the video (native, YouTube, or Vimeo). */
  onComplete?: () => void;
}) {
  const playback = parseVideoPlayback(src);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const completedRef = useRef(false);

  function finish() {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }

  useEffect(() => {
    completedRef.current = false;
  }, [src]);

  useEffect(() => {
    if (!onComplete || !playback) return;
    if (playback.kind !== "youtube" && playback.kind !== "vimeo") return;
    const active = playback;

    function onMessage(event: MessageEvent) {
      const origin = event.origin || "";
      if (active.kind === "youtube" && !origin.includes("youtube.com") && !origin.includes("youtube-nocookie.com")) {
        return;
      }
      if (active.kind === "vimeo" && !origin.includes("vimeo.com")) return;

      let data: unknown = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== "object") return;
      const payload = data as Record<string, unknown>;

      if (active.kind === "youtube") {
        // YT posts playerState 0 when ended (after enablejsapi + listening).
        if (payload.event === "onStateChange" && payload.info === 0) {
          finish();
          return;
        }
        const info = payload.info;
        if (
          payload.event === "infoDelivery" &&
          info &&
          typeof info === "object" &&
          (info as { playerState?: number }).playerState === 0
        ) {
          finish();
        }
        return;
      }

      // Vimeo finish event
      if (payload.event === "finish" || payload.method === "finish") {
        finish();
      }
    }

    window.addEventListener("message", onMessage);

    // Ask YouTube / Vimeo to start sending events.
    const timer = window.setInterval(() => {
      const frame = iframeRef.current?.contentWindow;
      if (!frame) return;
      if (active.kind === "youtube") {
        frame.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
      }
      if (active.kind === "vimeo") {
        frame.postMessage(JSON.stringify({ method: "addEventListener", value: "finish" }), "*");
      }
    }, 600);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
  }, [onComplete, playback]);

  if (!playback) return null;

  if (playback.kind === "youtube" || playback.kind === "vimeo") {
    const embedSrc = onComplete ? withTrackingParams(playback.kind, playback.src) : playback.src;
    return (
      <LessonMediaFrame kind="video">
        <iframe
          ref={iframeRef}
          src={embedSrc}
          title={title}
          className="aspect-video h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </LessonMediaFrame>
    );
  }

  return (
    <LessonMediaFrame kind="video">
      <video
        className="aspect-video w-full bg-ink"
        controls
        playsInline
        preload="metadata"
        src={playback.src}
        onEnded={finish}
        onTimeUpdate={(event) => {
          if (!onComplete) return;
          const video = event.currentTarget;
          if (!video.duration || !Number.isFinite(video.duration)) return;
          if (video.currentTime / video.duration >= 0.95) finish();
        }}
      >
        Video playback is not supported in this browser.
      </video>
    </LessonMediaFrame>
  );
}
