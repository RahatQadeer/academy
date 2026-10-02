"use client";

import { useEffect } from "react";
import { Button } from "@/base/components/Button";

/**
 * What a screen looks like when it throws.
 *
 * Beside `loading.tsx` and for the same reason: it sits under
 * `[product]/layout`, so the sidebar, the switcher and Quick Add stay where they
 * were and only the content area is replaced. Somebody whose Messages screen
 * failed can still reach Requests.
 *
 * Without this file there was no error boundary anywhere in the app, so any
 * throw on the client — including a server action whose POST never made it out,
 * which is all `ERR_NETWORK_CHANGED` means — escalated to the root and became
 * Next's own "Application error: a client-side exception has occurred". That is
 * a blank page with no way back, for what is usually a dropped connection.
 *
 * `reset()` re-renders the segment rather than reloading, so a screen that
 * failed on a network blip comes back without losing the rest of the session.
 * The digest is what identifies this crash in the server logs, and it is the
 * only thing worth showing: the message itself is minified in production.
 */
export default function ScreenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="px-12 py-9">
      <div className="max-w-[460px] rounded-card border border-line p-6">
        <h1 className="text-[17px] font-semibold">This screen didn&rsquo;t load</h1>
        <p className="mt-2 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          Something went wrong on our side, or the connection dropped on the way.
          Nothing you had already saved is affected.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <Button variant="primary" onClick={() => reset()}>
            Try again
          </Button>
          <Button variant="secondary" href="/">
            Go to the dashboard
          </Button>
        </div>
        {error.digest ? (
          <p className="mt-4 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
