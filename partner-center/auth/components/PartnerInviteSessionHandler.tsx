"use client";

import { useLayoutEffect } from "react";
import { createClient } from "@/base/lib/supabase/client";

const APP_HOME = "/partner-center";

/**
 * Session bootstrap for Partner Center team invite links only.
 *
 * Supabase invite emails can land on /partner-center/invite/<token>#access_token…
 * Root AuthHashHandler would then send any /partner-center path to /partner-center
 * (no entitlement yet → /switcher) before the accept form can run.
 *
 * useLayoutEffect runs before the root handler's useEffect, so we strip the hash
 * and claim the session first. When `continueTo` is set (already-accepted invite),
 * we finish into the app instead of leaving the user on a dead invite screen.
 */
export function PartnerInviteSessionHandler({
  continueTo,
}: {
  continueTo?: string | null;
} = {}) {
  useLayoutEffect(() => {
    const destination = continueTo?.trim() || null;
    const hash = window.location.hash;

    if (!hash || hash.length < 2) {
      if (destination) window.location.replace(destination);
      return;
    }

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      if (destination) window.location.replace(destination);
      return;
    }

    // Strip before AuthHashHandler's useEffect can redirect away from the invite.
    const path = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", path);

    let supabase;
    try {
      supabase = createClient();
    } catch {
      if (destination) window.location.replace(destination);
      return;
    }

    void supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          window.location.replace(
            `/partner-center/signin?error=${encodeURIComponent(error.message)}`,
          );
          return;
        }
        if (destination) window.location.replace(destination);
      });
  }, [continueTo]);

  return null;
}

export { APP_HOME as PARTNER_INVITE_CONTINUE_PATH };
