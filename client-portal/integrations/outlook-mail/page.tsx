import { MailScreen } from "../components/MailScreen";
import type { ScreenProps } from "@/client-portal/lib/routing";

/** The same allowance Gmail's screen takes, and for the same reason. */
export const maxDuration = 300;

/** Outlook Mail's summaries. The screen itself is shared with Gmail. */
export default async function OutlookMailScreen(props: ScreenProps) {
  return (
    <MailScreen {...props} provider="outlook_mail" here="/client-portal/integrations/outlook-mail" />
  );
}
