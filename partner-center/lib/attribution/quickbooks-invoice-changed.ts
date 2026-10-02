import { queryPaymentsLinkedToInvoice } from "@/partner-center/lib/quickbooks/api";
import { handleQuickBooksPaymentCreated } from "@/partner-center/lib/attribution/quickbooks-payment-created";
import { getValidQuickBooksAccessToken } from "@/partner-center/lib/quickbooks/credentials";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function handleQuickBooksInvoiceChanged(
  supabase: SupabaseClient,
  input: { invoiceId: string; realmId?: string | null },
): Promise<{
  ok: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  paymentResults?: unknown[];
}> {
  const auth = await getValidQuickBooksAccessToken(supabase);
  if (!auth) {
    return {
      ok: false,
      error: "QuickBooks is not connected or tokens could not be refreshed.",
    };
  }

  if (input.realmId && input.realmId !== auth.realmId) {
    return {
      ok: true,
      skipped: true,
      reason: "Webhook realm does not match connected QuickBooks company.",
    };
  }

  const linked = await queryPaymentsLinkedToInvoice(
    auth.accessToken,
    auth.realmId,
    input.invoiceId,
  );
  if (linked.error) {
    return { ok: false, error: linked.error };
  }

  const paymentIds = linked.paymentIds ?? [];
  if (paymentIds.length === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "Invoice has no linked payments yet.",
    };
  }

  const paymentResults = [];
  for (const paymentId of paymentIds) {
    const result = await handleQuickBooksPaymentCreated(supabase, {
      paymentId,
      realmId: input.realmId,
    });
    paymentResults.push({ paymentId, result });
    if (!result.ok && !result.skipped) {
      return {
        ok: false,
        error: result.error,
        paymentResults,
      };
    }
  }

  return { ok: true, paymentResults };
}
