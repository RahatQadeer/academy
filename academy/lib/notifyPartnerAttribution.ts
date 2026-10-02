import "server-only";

/**
 * Cross-module handoff to Partner Center (SRS §17.5.13).
 * Academy must not import partner-center — HTTP only.
 */
export type AcademyPartnerAttributionPayload = {
  referredUserId: string;
  qualifyingAction: "paid_enrollment" | "free_enrollment";
  commissionable: boolean;
  eventSource: "stripe" | "manual";
  externalPaymentId?: string;
  productId?: string;
  amountCollectedCents?: number;
  eventTimestamp?: string;
};

function attributionBaseUrl(): string {
  // Prefer this deployment. NEXT_PUBLIC_SITE_URL often points at an old
  // preview host (e.g. *-dun) and self-notify never hits Production.
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (site) return site;
  return "http://localhost:3000";
}

export async function notifyPartnerAcademyAttribution(
  payload: AcademyPartnerAttributionPayload,
): Promise<void> {
  const secret = process.env.PARTNER_ATTRIBUTION_SECRET?.trim();
  if (!secret) {
    console.warn(
      "[academy attribution] PARTNER_ATTRIBUTION_SECRET is not set; skipping.",
    );
    return;
  }

  const url = `${attributionBaseUrl()}/api/partner-center/attribution`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referredUserId: payload.referredUserId,
        product: "academy",
        qualifyingAction: payload.qualifyingAction,
        commissionable: payload.commissionable,
        eventSource: payload.eventSource,
        externalPaymentId: payload.externalPaymentId,
        productId: payload.productId,
        amountCollectedCents: payload.amountCollectedCents,
        eventTimestamp: payload.eventTimestamp,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        "[academy attribution] failed",
        response.status,
        url,
        text.slice(0, 300),
      );
    }
  } catch (error) {
    console.error("[academy attribution] request error", url, error);
  }
}
