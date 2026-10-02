import Link from "next/link";
import { PartnerLoadError } from "@/partner-center/components/states/PartnerLoadError";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { MessagesView } from "@/partner-center/messages/components/MessagesView";
import { loadMessagesPage } from "@/partner-center/messages/lib/load-messages";

export async function MessagesPageContent({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { context, user } = await requirePartnerAppAccess();
  const channelRaw =
    typeof searchParams?.channel === "string" ? searchParams.channel : "";
  const channel =
    channelRaw === "support_billing" ? "support_billing" : "partner_manager";
  const result = await loadMessagesPage(context, user, channel);
  if (!result.ok) {
    return (
      <PartnerLoadError
        retryHref="/partner-center/messages"
        message={result.error}
      />
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 px-4 pt-3">
        <Link
          href="/partner-center/messages?channel=partner_manager"
          className="rounded-md px-3 py-1.5 text-[13px] no-underline"
          style={{
            background:
              channel === "partner_manager"
                ? "rgba(55,53,47,0.08)"
                : "transparent",
            color: "var(--ink)",
            fontWeight: channel === "partner_manager" ? 600 : 400,
          }}
        >
          Partner Manager
        </Link>
        <Link
          href="/partner-center/messages?channel=support_billing"
          className="rounded-md px-3 py-1.5 text-[13px] no-underline"
          style={{
            background:
              channel === "support_billing"
                ? "rgba(55,53,47,0.08)"
                : "transparent",
            color: "var(--ink)",
            fontWeight: channel === "support_billing" ? 600 : 400,
          }}
        >
          Support and Billing
        </Link>
      </div>
      <MessagesView data={result.data} />
    </div>
  );
}
