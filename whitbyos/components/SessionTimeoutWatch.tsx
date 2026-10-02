"use client";

import { useEffect } from "react";
import {
  SESSION_TIMEOUT_EVENT,
  readSessionTimeout,
} from "@/whitbyos/lib/session-timeout";

const CHECK_MS = 15_000;
const SIGN_OUT = `/auth/sign-out?next=${encodeURIComponent("/login?notice=session-timeout")}`;

/**
 * Signs this device out after a stretch of no typing or clicking.
 *
 * The length is chosen on Sign-in / Session Timeout and kept on this browser.
 * Other devices are untouched.
 */
export function SessionTimeoutWatch() {
  useEffect(() => {
    let minutes = readSessionTimeout();
    let last = Date.now();
    let ticking = false;

    function bump() {
      last = Date.now();
    }

    function onStorage(event: StorageEvent) {
      if (event.key === "pa-session-timeout-minutes") minutes = readSessionTimeout();
    }

    function onPref() {
      minutes = readSessionTimeout();
      last = Date.now();
    }

    function check() {
      if (minutes <= 0) return;
      if (document.visibilityState === "hidden") return;
      if (Date.now() - last < minutes * 60_000) return;
      if (ticking) return;
      ticking = true;
      window.location.assign(SIGN_OUT);
    }

    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "mousemove", "scroll"];
    events.forEach((name) => window.addEventListener(name, bump, { passive: true }));
    window.addEventListener("storage", onStorage);
    window.addEventListener(SESSION_TIMEOUT_EVENT, onPref);
    const timer = window.setInterval(check, CHECK_MS);

    return () => {
      events.forEach((name) => window.removeEventListener(name, bump));
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SESSION_TIMEOUT_EVENT, onPref);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
