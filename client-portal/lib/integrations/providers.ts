import type { IntegrationKey } from "@/client-portal/types";

/**
 * What it takes to connect each of the four — `whitbyos/lib/oauth-providers.ts`,
 * narrowed to them.
 *
 * Every one is the same round trip: to the provider's consent page, back with a
 * code, the code swapped for a token. Only URLs, scopes and parameters differ,
 * so those are the only things written down.
 *
 * Google Calendar sits in this table rather than in a module of its own, as it
 * does in Whitby. Whitby's needs its own start route because it also writes
 * events back; the portal only reads a client's calendar, so its consent is the
 * ordinary one.
 *
 * SCOPES ARE READ-ONLY WHERE WHITBY'S ARE NOT
 *
 * Whitby asks for `calendar.events`, `Calendars.ReadWrite` and `Mail.Send`
 * because a professional creates events and sends from Whitby. Nothing in the
 * portal writes to a client's calendar or sends from their mailbox, and a
 * consent screen that asks for more than the product does is one a client
 * rightly refuses.
 *
 * THE REDIRECT URIS ARE NEW
 *
 * `/api/client-portal/integrations/<provider>/callback` has to be added to the
 * Google Cloud and Microsoft Entra app registrations beside Whitby's own, or
 * the provider refuses the round trip with `redirect_uri_mismatch`.
 */
export type OAuthProvider = {
  key: IntegrationKey;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  /** Where a grant is given back, where the provider has such an endpoint. */
  revokeUrl?: string;
  scopes: string;
  clientIdVar: string;
  clientSecretVar: string;
  authorizeParams?: Record<string, string>;
};

const MICROSOFT_TENANT = process.env.MICROSOFT_TENANT_ID || "common";
const MICROSOFT_AUTHORIZE = `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize`;
const MICROSOFT_TOKEN = `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`;

const GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE = "https://oauth2.googleapis.com/revoke";

/**
 * Offline plus a forced prompt, or Google withholds the refresh token on every
 * grant after the first and the connection dies in an hour.
 */
const GOOGLE_PARAMS = {
  access_type: "offline",
  prompt: "consent",
  include_granted_scopes: "true",
};

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    key: "google_calendar",
    label: "Google Calendar",
    authorizeUrl: GOOGLE_AUTHORIZE,
    tokenUrl: GOOGLE_TOKEN,
    revokeUrl: GOOGLE_REVOKE,
    scopes: "openid email https://www.googleapis.com/auth/calendar.events.readonly",
    clientIdVar: "GOOGLE_CLIENT_ID",
    clientSecretVar: "GOOGLE_CLIENT_SECRET",
    authorizeParams: GOOGLE_PARAMS,
  },
  {
    key: "outlook_calendar",
    label: "Outlook Calendar",
    authorizeUrl: MICROSOFT_AUTHORIZE,
    tokenUrl: MICROSOFT_TOKEN,
    scopes: "openid email offline_access Calendars.Read",
    clientIdVar: "MICROSOFT_CLIENT_ID",
    clientSecretVar: "MICROSOFT_CLIENT_SECRET",
    authorizeParams: { response_mode: "query" },
  },
  {
    key: "gmail",
    label: "Gmail",
    authorizeUrl: GOOGLE_AUTHORIZE,
    tokenUrl: GOOGLE_TOKEN,
    revokeUrl: GOOGLE_REVOKE,
    scopes: "openid email https://www.googleapis.com/auth/gmail.readonly",
    clientIdVar: "GOOGLE_CLIENT_ID",
    clientSecretVar: "GOOGLE_CLIENT_SECRET",
    authorizeParams: GOOGLE_PARAMS,
  },
  {
    key: "outlook_mail",
    label: "Outlook Mail",
    authorizeUrl: MICROSOFT_AUTHORIZE,
    tokenUrl: MICROSOFT_TOKEN,
    scopes: "openid email offline_access Mail.Read",
    clientIdVar: "MICROSOFT_CLIENT_ID",
    clientSecretVar: "MICROSOFT_CLIENT_SECRET",
    authorizeParams: { response_mode: "query" },
  },
];

export function oauthProvider(key: string): OAuthProvider | null {
  return OAUTH_PROVIDERS.find((provider) => provider.key === key) ?? null;
}

/** Whether this deployment holds the app's identity for a provider. */
export function oauthConfigured(provider: OAuthProvider) {
  return Boolean(process.env[provider.clientIdVar] && process.env[provider.clientSecretVar]);
}

export function connectableKeys(): Set<IntegrationKey> {
  return new Set(OAUTH_PROVIDERS.filter(oauthConfigured).map((provider) => provider.key));
}
