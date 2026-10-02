import "server-only";

import {
  intuitApiBaseUrl,
} from "@/partner-center/lib/quickbooks/config";

export type QbPayment = {
  Id: string;
  TotalAmt?: number;
  TxnDate?: string;
  PrivateNote?: string;
  PaymentRefNum?: string;
  CustomerRef?: { value?: string; name?: string };
  Line?: Array<{
    LinkedTxn?: Array<{ TxnType?: string; TxnId?: string }>;
  }>;
  MetaData?: { CreateTime?: string; LastUpdatedTime?: string };
};

export type QbInvoice = {
  Id: string;
  DocNumber?: string;
  PrivateNote?: string;
  CustomerMemo?: { value?: string };
  CustomerRef?: { value?: string; name?: string };
  CustomField?: Array<{
    DefinitionId?: string;
    Name?: string;
    Type?: string;
    StringValue?: string;
  }>;
};

export type QbCustomer = {
  Id: string;
  DisplayName?: string;
  PrimaryEmailAddr?: { Address?: string };
  CompanyName?: string;
  Notes?: string;
};

async function qboGet<T>(
  accessToken: string,
  realmId: string,
  path: string,
): Promise<{ data?: T; error?: string }> {
  const url = `${intuitApiBaseUrl()}/v3/company/${encodeURIComponent(realmId)}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const fault = body.Fault as
      | { Error?: Array<{ Message?: string; Detail?: string }> }
      | undefined;
    const message =
      fault?.Error?.[0]?.Detail ||
      fault?.Error?.[0]?.Message ||
      `QuickBooks request failed (${response.status}).`;
    return { error: message };
  }

  return { data: body as T };
}

export async function fetchQbPayment(
  accessToken: string,
  realmId: string,
  paymentId: string,
): Promise<{ payment?: QbPayment; error?: string }> {
  const result = await qboGet<{ Payment?: QbPayment }>(
    accessToken,
    realmId,
    `/payment/${encodeURIComponent(paymentId)}?minorversion=65`,
  );
  if (result.error) return { error: result.error };
  if (!result.data?.Payment) return { error: "Payment not found in QuickBooks." };
  return { payment: result.data.Payment };
}

export async function fetchQbInvoice(
  accessToken: string,
  realmId: string,
  invoiceId: string,
): Promise<{ invoice?: QbInvoice; error?: string }> {
  const result = await qboGet<{ Invoice?: QbInvoice }>(
    accessToken,
    realmId,
    `/invoice/${encodeURIComponent(invoiceId)}?minorversion=65`,
  );
  if (result.error) return { error: result.error };
  if (!result.data?.Invoice) return { error: "Invoice not found in QuickBooks." };
  return { invoice: result.data.Invoice };
}

export async function fetchQbCustomer(
  accessToken: string,
  realmId: string,
  customerId: string,
): Promise<{ customer?: QbCustomer; error?: string }> {
  const result = await qboGet<{ Customer?: QbCustomer }>(
    accessToken,
    realmId,
    `/customer/${encodeURIComponent(customerId)}?minorversion=65`,
  );
  if (result.error) return { error: result.error };
  if (!result.data?.Customer) {
    return { error: "Customer not found in QuickBooks." };
  }
  return { customer: result.data.Customer };
}

/** Company display name for Program config Account (no openid scope required). */
export async function fetchQbCompanyDisplayName(
  accessToken: string,
  realmId: string,
): Promise<string | null> {
  const result = await qboGet<{
    CompanyInfo?: { CompanyName?: string; LegalName?: string };
  }>(accessToken, realmId, `/companyinfo/${encodeURIComponent(realmId)}?minorversion=65`);

  const info = result.data?.CompanyInfo;
  const name = info?.CompanyName?.trim() || info?.LegalName?.trim() || null;
  return name;
}

/**
 * Find Payment ids linked to an Invoice via LinkedTxn (reverse of invoiceIdFromPayment).
 * QBO query: payments whose LinkedTxn references this invoice.
 */
export async function queryPaymentsLinkedToInvoice(
  accessToken: string,
  realmId: string,
  invoiceId: string,
): Promise<{ paymentIds?: string[]; error?: string }> {
  const safeId = invoiceId.replace(/'/g, "\\'");
  const query = encodeURIComponent(
    `select * from Payment where Line.LinkedTxn.TxnId = '${safeId}' maxresults 100`,
  );
  const result = await qboGet<{
    QueryResponse?: { Payment?: QbPayment[] | QbPayment };
  }>(accessToken, realmId, `/query?query=${query}&minorversion=65`);

  if (result.error) {
    // Fallback: load invoice LinkedTxn of type Payment if present on Balance/Linked
    const invoiceResult = await fetchQbInvoice(accessToken, realmId, invoiceId);
    if (invoiceResult.error || !invoiceResult.invoice) {
      return { error: result.error };
    }
    return { paymentIds: [] };
  }

  const raw = result.data?.QueryResponse?.Payment;
  const payments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const paymentIds = payments
    .map((payment) => payment.Id)
    .filter((id): id is string => Boolean(id));

  // Also check LinkedTxn on the invoice itself when query returns empty
  if (paymentIds.length === 0) {
    const invoiceResult = await fetchQbInvoice(accessToken, realmId, invoiceId);
    const invoice = invoiceResult.invoice as QbInvoice & {
      LinkedTxn?: Array<{ TxnType?: string; TxnId?: string }>;
    } | undefined;
    for (const linked of invoice?.LinkedTxn ?? []) {
      if (linked.TxnType === "Payment" && linked.TxnId) {
        paymentIds.push(linked.TxnId);
      }
    }
  }

  return { paymentIds: [...new Set(paymentIds)] };
}

export function invoiceIdFromPayment(payment: QbPayment): string | null {
  for (const line of payment.Line ?? []) {
    for (const linked of line.LinkedTxn ?? []) {
      if (linked.TxnType === "Invoice" && linked.TxnId) {
        return linked.TxnId;
      }
    }
  }
  return null;
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const STRIPE_REF_RE = /\b(pi_|ch_|py_)[A-Za-z0-9]+/;

export function opportunityIdFromQbText(...parts: Array<string | null | undefined>): string | null {
  for (const part of parts) {
    if (!part) continue;
    const match = part.match(UUID_RE);
    if (match?.[0]) return match[0];
  }
  return null;
}

export function stripeRefsInText(...parts: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    const matches = part.match(new RegExp(STRIPE_REF_RE, "g"));
    for (const match of matches ?? []) {
      found.add(match);
    }
  }
  return [...found];
}

export function dollarsToCents(amount: number | undefined): number {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}
