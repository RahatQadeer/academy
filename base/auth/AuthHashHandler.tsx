"use client";

import { useEffect } from "react";
import { createClient } from "@/base/lib/supabase/client";

export function AuthHashHandler() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (!accessToken || !refreshToken) return;

    let supabase;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    void supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        const path = window.location.pathname;

        // An invitation link lands here, on the page that asks for a password
        // and accepts the invitation. Sending them on to /switcher (or
        // /partner-center before membership exists) signs them in and abandons
        // the invitation half-done: the password is never set, the invitation
        // stays pending, and the screen they needed flashes past.
        // Opening the link a second time works only because the token is spent
        // by then, so no session is made and nothing redirects.
        //
        // postAuthPath makes the same exception for the same reason. Stay, and
        // just take the tokens out of the address bar.
        // Partner Center team invites use /partner-center/invite/<token>.
        if (
          path.startsWith("/invite/") ||
          path.startsWith("/partner-center/invite/")
        ) {
          window.history.replaceState(null, "", path + window.location.search);
          return;
        }

        const partner = path.startsWith("/partner-center");
        const next =
          type === "recovery"
            ? partner
              ? "/partner-center/reset-password"
              : "/reset-password"
            : type === "signup" || type === "email"
              ? partner
                ? "/partner-center/confirmed"
                : "/confirmed"
              : partner
                ? "/partner-center"
                : "/switcher";
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        const login = partner ? "/partner-center/signin" : "/login";
        window.location.replace(error ? `${login}?error=${encodeURIComponent(error.message)}` : next);
      });
  }, []);

  return null;
}
