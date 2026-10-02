import "server-only";

export function intuitConfigured(): boolean {
  return Boolean(
    process.env.INTUIT_CLIENT_ID?.trim() &&
      process.env.INTUIT_CLIENT_SECRET?.trim(),
  );
}

export function intuitEnvironment(): "sandbox" | "production" {
  const raw = process.env.INTUIT_ENVIRONMENT?.trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

export function intuitApiBaseUrl(): string {
  return intuitEnvironment() === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export function intuitAuthorizeUrl(): string {
  return "https://appcenter.intuit.com/connect/oauth2";
}

export function intuitTokenUrl(): string {
  return "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
}

/** Accounting only — extra openid/email scopes have caused Intuit "undefined didn't connect". */
export const INTUIT_SCOPES = "com.intuit.quickbooks.accounting";

export const QB_OAUTH_STATE_COOKIE = "pa_partner_qb_oauth_state";

export function intuitClientId(): string {
  return process.env.INTUIT_CLIENT_ID?.trim() ?? "";
}

export function intuitClientSecret(): string {
  return process.env.INTUIT_CLIENT_SECRET?.trim() ?? "";
}

export function intuitWebhookVerifier(): string | null {
  return process.env.INTUIT_WEBHOOK_VERIFIER_TOKEN?.trim() || null;
}
