"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The button that actually hands back the file.
 *
 * Exporting used to be three steps: choose the options, land back on the plan,
 * and press "Download PDF" in a toast that had just told you the export was
 * finished — which it was not, because nothing had been rendered yet. The
 * route that renders the document answers with `Content-Disposition:
 * attachment`, so pointing the browser at it downloads the file and leaves the
 * page where it is. One press.
 *
 * The dialog closes itself afterwards. A modal still standing over the plan
 * after the file has arrived reads as though nothing happened.
 */
export function ExportSubmit({
  planId,
  closeHref,
}: {
  planId: string;
  /** The plan without the dialog's own search param. */
  closeHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="submit"
      disabled={busy}
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (!form) return;

        event.preventDefault();
        setBusy(true);

        // The options as the form holds them, which is what the route reads.
        const query = new URLSearchParams(
          [...new FormData(form).entries()].map(([key, value]) => [key, String(value)]),
        );
        query.set("format", "pdf");

        // Not a navigation: an attachment response leaves the page alone, so
        // the router push below is what moves, and it moves to the plan.
        window.location.href = `/api/whitbyos/work-plans/${planId}/export?${query.toString()}`;

        // Long enough for the request to be on its way. Closing sooner can
        // cancel a navigation the browser has not committed to yet.
        setTimeout(() => router.push(closeHref), 1200);
      }}
      className="rounded-[6px] border px-4 py-[9px] text-[13.5px] font-medium text-white disabled:opacity-70"
      style={{ background: "var(--ink)", borderColor: "var(--ink)" }}
    >
      {busy ? "Preparing…" : "Export PDF"}
    </button>
  );
}
