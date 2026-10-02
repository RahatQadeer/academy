"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type LessonCompletionRequirements = {
  needsScroll: boolean;
  needsVideo: boolean;
};

type LessonCompletionContextValue = {
  requirements: LessonCompletionRequirements;
  scrollDone: boolean;
  videoDone: boolean;
  canComplete: boolean;
  markScrollDone: () => void;
  markVideoDone: () => void;
  hint: string | null;
};

const LessonCompletionContext = createContext<LessonCompletionContextValue | null>(null);

function unlockedState(requirements: LessonCompletionRequirements) {
  return {
    scrollDone: !requirements.needsScroll,
    videoDone: !requirements.needsVideo,
  };
}

export function LessonCompletionProvider({
  lessonId,
  requirements,
  children,
}: {
  lessonId: string;
  /** Set by the shell from lesson type — avoids waiting on nested content. */
  requirements: LessonCompletionRequirements;
  children: ReactNode;
}) {
  const [scrollDone, setScrollDone] = useState(() => unlockedState(requirements).scrollDone);
  const [videoDone, setVideoDone] = useState(() => unlockedState(requirements).videoDone);

  useEffect(() => {
    const next = unlockedState(requirements);
    setScrollDone(next.scrollDone);
    setVideoDone(next.videoDone);
  }, [lessonId, requirements.needsScroll, requirements.needsVideo]);

  // Video embeds often never fire completion (blocked iframe / no postMessage).
  // After a short grace period, unlock Mark complete so learners are not stuck.
  useEffect(() => {
    if (!requirements.needsVideo) return;
    const timer = window.setTimeout(() => setVideoDone(true), 45_000);
    return () => window.clearTimeout(timer);
  }, [lessonId, requirements.needsVideo]);

  const markScrollDone = useCallback(() => setScrollDone(true), []);
  const markVideoDone = useCallback(() => setVideoDone(true), []);

  const canComplete =
    (!requirements.needsScroll || scrollDone) && (!requirements.needsVideo || videoDone);

  const hint = useMemo(() => {
    if (canComplete) return null;
    if (requirements.needsVideo && !videoDone) {
      return "Watch the video (or wait a moment) to unlock Mark complete.";
    }
    if (requirements.needsScroll && !scrollDone) {
      return "Scroll to the end to unlock Mark complete.";
    }
    return null;
  }, [canComplete, requirements.needsScroll, requirements.needsVideo, scrollDone, videoDone]);

  const value = useMemo(
    () => ({
      requirements,
      scrollDone,
      videoDone,
      canComplete,
      markScrollDone,
      markVideoDone,
      hint,
    }),
    [requirements, scrollDone, videoDone, canComplete, markScrollDone, markVideoDone, hint],
  );

  return (
    <LessonCompletionContext.Provider value={value}>{children}</LessonCompletionContext.Provider>
  );
}

export function useLessonCompletionGate() {
  return useContext(LessonCompletionContext);
}
