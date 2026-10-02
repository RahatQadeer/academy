import { MailScreen } from "../components/MailScreen";
import type { ScreenProps } from "@/client-portal/lib/routing";

/**
 * Sync now reads the mailbox while the client waits, and a mailbox with a
 * month of new mail in it is a model call per message. The default ceiling is
 * far under that — this is the same allowance the cron route gives itself.
 */
export const maxDuration = 300;

/** Gmail's summaries. The screen itself is shared with Outlook Mail. */
export default async function GmailScreen(props: ScreenProps) {
  return <MailScreen {...props} provider="gmail" here="/client-portal/integrations/gmail" />;
}
