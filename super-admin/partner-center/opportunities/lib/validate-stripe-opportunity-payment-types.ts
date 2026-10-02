export type StripeOpportunityMatchMethod =
  | "metadata"
  | "company_name"
  | "email";

export type ValidateStripeOpportunityPaymentResult =
  | {
      ok: true;
      resolvedPaymentId: string;
      invoiceId: string;
      amountCollectedCents: number;
      invoiceStatus: string;
      customerName: string;
      opportunityCompanyName: string;
      partnerName: string;
      commissionOwedUsd: number | null;
      commissionNote: string | null;
      matchMethod: StripeOpportunityMatchMethod;
      eventTimestamp: string;
    }
  | { ok: false; error: string };
