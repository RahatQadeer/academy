"use client";

import { useRouter } from "next/navigation";

/**
 * Export, and then get out of the way.
 *
 * The form's answer is a file, so this page never navigates — which is why
 * the dialog has to close itself afterwards. It used to send the page to a
 * confirmation as well, a toast reading "Timeline exported · Download PDF",
 * offered after the download had already happened and without the range or
 * the sections that were just chosen. The file arriving is the confirmation.
 */
export function ExportButton({ doneHref }: { doneHref: string }) {
  const router = useRouter();

  return (
    <button
      type="submit"
      onClick={() => {
        // After the browser has handled the submit, not instead of it.
        setTimeout(() => router.push(doneHref), 0);
      }}
      className="rounded-control px-[18px] py-[9px] text-[13.5px] font-medium text-white"
      style={{ background: "var(--accent)" }}
    >
      Export
    </button>
  );
}
