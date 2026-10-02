import type { ProviderKey } from "@/whitbyos/lib/integrations";

/**
 * What it takes to connect each of screen 16's apps.
 *
 * Every one of them is the same round trip: send somebody to the provider's
 * consent page, take back a code, swap it for a token, and record which
 * account the token belongs to. Only the URLs, the scopes and the shape of
 * the answer differ, so those are the only things written down here.
 *
 * Google Calendar is not in this table. It has its own module because it does
 * far more than connect: it syncs a window of events both ways, refreshes its
 * own grant and revokes it. This is the connection only.
 */
export type OAuthProvider = {
  key: ProviderKey;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  /**
   * How the provider wants its scope list joined. OAuth 2.0 says a space and
   * most of them agree; Slack wants commas, which its own generated install
   * URL confirms.
   */
  scopeSeparator?: "," | " ";
  /**
   * Slack's v2 authorize endpoint does not take `response_type`, and its own
   * generated install URL does not send one. Everyone else requires it.
   */
  omitResponseType?: boolean;
  /** The environment variables that hold the app's identity. */
  clientIdVar: string;
  clientSecretVar: string;
  /** Extra parameters the provider wants on the consent URL. */
  authorizeParams?: Record<string, string>;
  /** Where the account's own name lives in the token response. */
  account?: { email?: string; id?: string };
};

const MICROSOFT_TENANT = process.env.MICROSOFT_TENANT_ID || "common";

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    key: "outlook_calendar",
    label: "Outlook Calendar",
    authorizeUrl: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`,
    scopes: "openid email offline_access Calendars.ReadWrite",
    clientIdVar: "MICROSOFT_CLIENT_ID",
    clientSecretVar: "MICROSOFT_CLIENT_SECRET",
    authorizeParams: { response_mode: "query" },
  },
  {
    key: "outlook_mail",
    label: "Outlook Mail",
    authorizeUrl: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`,
    scopes: "openid email offline_access Mail.Read Mail.Send",
    clientIdVar: "MICROSOFT_CLIENT_ID",
    clientSecretVar: "MICROSOFT_CLIENT_SECRET",
    authorizeParams: { response_mode: "query" },
  },
  {
    key: "gmail",
    label: "Gmail",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "openid email https://www.googleapis.com/auth/gmail.readonly",
    clientIdVar: "GOOGLE_CLIENT_ID",
    clientSecretVar: "GOOGLE_CLIENT_SECRET",
    authorizeParams: { access_type: "offline", prompt: "consent" },
  },
  {
    key: "google_drive",
    label: "Google Drive",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    // drive.file, not drive: it reaches only the files Whitby itself puts
    // there, which is all this does and all it should be trusted with.
    scopes: "openid email https://www.googleapis.com/auth/drive.file",
    clientIdVar: "GOOGLE_CLIENT_ID",
    clientSecretVar: "GOOGLE_CLIENT_SECRET",
    authorizeParams: { access_type: "offline", prompt: "consent" },
  },
  {
    key: "slack",
    label: "Slack",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: "chat:write channels:read",
    scopeSeparator: ",",
    omitResponseType: true,
    clientIdVar: "SLACK_CLIENT_ID",
    clientSecretVar: "SLACK_CLIENT_SECRET",
    account: { id: "team.id", email: "team.name" },
  },
  {
    key: "quickbooks",
    label: "QuickBooks Online",
    authorizeUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    scopes: "com.intuit.quickbooks.accounting openid email",
    clientIdVar: "INTUIT_CLIENT_ID",
    clientSecretVar: "INTUIT_CLIENT_SECRET",
  },
  {
    key: "stripe",
    label: "Stripe",
    authorizeUrl: "https://connect.stripe.com/oauth/authorize",
    tokenUrl: "https://connect.stripe.com/oauth/token",
    scopes: "read_only",
    clientIdVar: "STRIPE_CONNECT_CLIENT_ID",
    clientSecretVar: "STRIPE_SECRET_KEY",
    account: { id: "stripe_user_id" },
  },
];

export function oauthProvider(key: string): OAuthProvider | null {
  return OAUTH_PROVIDERS.find((provider) => provider.key === key) ?? null;
}

/** Whether this deployment has been given the app's identity for a provider. */
export function oauthConfigured(provider: OAuthProvider) {
  return Boolean(process.env[provider.clientIdVar] && process.env[provider.clientSecretVar]);
}

/** Every provider this deployment could actually connect right now. */
export function connectableProviders(): Set<string> {
  const ready = new Set<string>();
  for (const provider of OAUTH_PROVIDERS) {
    if (oauthConfigured(provider)) ready.add(provider.key);
  }
  return ready;
}
