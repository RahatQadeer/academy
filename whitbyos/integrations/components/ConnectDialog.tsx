import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Modal } from "@/whitbyos/components/Modal";
import type { IntegrationRow } from "@/whitbyos/lib/integrations";

/**
 * What Connect opens for an app that cannot connect yet.
 *
 * Screen 16 draws Connect on every unconnected row, and it should look that
 * way. But only Google Calendar has an app registered against it, so the rest
 * would fail at the provider with a page nobody wrote. This says why instead,
 * and says it in terms of who can fix it.
 */

/** What is actually missing, per app. Vague copy here would be worse than none. */
const BLOCKED_ON: Partial<Record<string, string>> = {
  gmail:
    "Google has to verify Whitby for the Gmail scope before it can be offered outside a test list. The review is with them.",
  outlook_mail: "Whitby has not been registered as an app with Microsoft yet.",
  outlook_calendar: "Whitby has not been registered as an app with Microsoft yet.",
  google_drive:
    "The Drive scope is a separate grant from the Calendar one, and has not been requested yet.",
  slack: "Whitby has not been published as a Slack app yet.",
  quickbooks: "Whitby has not been registered as an app with Intuit yet.",
  stripe: "The Stripe Connect application has not been set up yet.",
};

export function ConnectDialog({
  row,
  closeHref,
}: {
  row: IntegrationRow;
  closeHref: string;
}) {
  return (
    <Modal title={`Connect ${row.name}`} closeHref={closeHref} width={440} dense>
      <p
        className="-mt-2 mb-4 text-[13.5px] leading-[1.6]"
        style={{ color: "var(--text-secondary)" }}
      >
        {row.name} is supported, but it cannot be connected from here yet.{" "}
        {BLOCKED_ON[row.key] ?? "The provider credentials are not in place yet."}
      </p>

      <p
        className="mb-5 text-[13.5px] leading-[1.6]"
        style={{ color: "var(--text-secondary)" }}
      >
        Nothing on this screen changes when it becomes available: the same
        Connect button will start the sign-in with {row.name}.
      </p>

      <div className="flex justify-end gap-2.5">
        <Button unsized
          href={`mailto:support@privateattache.com?subject=${encodeURIComponent(
            `Connect ${row.name}`,
          )}`}
          variant="secondary"
          className="px-4 py-[9px] text-[13.5px]"
        >
          Ask support
        </Button>
        <Link
          href={closeHref}
          className="rounded-control px-[18px] py-[9px] text-[13.5px] font-medium text-white no-underline hover:text-white"
          style={{ background: "var(--accent)" }}
        >
          Got it
        </Link>
      </div>
    </Modal>
  );
}
