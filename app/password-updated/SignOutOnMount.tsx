"use client";

import { useEffect } from "react";
import { createClient } from "@/base/lib/supabase/client";

/**
 * Reset leaves a session; 3.3's CTA is "Continue to sign in". Cookie writes
 * from the Server Component's `signOut` are swallowed, so this does it in
 * the browser. Partner Center never lands here, so its session is untouched.
 */
export function SignOutOnMount() {
  useEffect(() => {
    try {
      void createClient().auth.signOut();
    } catch {
      // Preview without Supabase still shows the success screen.
    }
  }, []);
  return null;
}
