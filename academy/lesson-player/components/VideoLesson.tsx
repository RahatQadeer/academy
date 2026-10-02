"use client";

import { LessonMediaFrame } from "@/academy/admin/catalog/components/lesson/LessonMediaFrame";
import { LessonVideoPlayer } from "@/academy/admin/catalog/components/lesson/LessonVideoPlayer";
import { parseVideoPlayback } from "@/academy/lib/videoEmbed";
import { isLikelyMediaFile } from "../utils/curriculum";
import type { LessonMedia } from "../types";

export function VideoLesson({
  media,
  onComplete,
}: {
  media: LessonMedia;
  onComplete?: () => void;
}) {
  if (media.signedUrl) {
    return <LessonVideoPlayer src={media.signedUrl} onComplete={onComplete} />;
  }

  if (!media.externalUrl) return null;

  const playback = parseVideoPlayback(media.externalUrl);
  if (
    playback &&
    (playback.kind === "youtube" || playback.kind === "vimeo" || isLikelyMediaFile(media.externalUrl))
  ) {
    return <LessonVideoPlayer src={media.externalUrl} onComplete={onComplete} />;
  }

  return (
    <LessonMediaFrame kind="video">
      <div className="flex aspect-video flex-col items-center justify-center px-6 text-center">
        <p className="text-[14.5px] leading-relaxed" style={{ color: "rgba(255,255,255,.85)" }}>
          This video is stored as an external link. Open it to continue, then return here.
        </p>
        <a
          href={media.externalUrl}
          className="mt-4 inline-flex text-[13.5px] text-white underline hover:text-white"
          rel="noreferrer"
          onClick={() => onComplete?.()}
        >
          Open video source
        </a>
      </div>
    </LessonMediaFrame>
  );
}
