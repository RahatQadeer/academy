/**
 * Structured payment terms for commission rules (§17.7.6 / §17.14.9).
 * Stored in partner_commission_rules.payment_terms as JSON or legacy "Net 30" text.
 */

export type PaymentTermsCadence = "net" | "monthly_in_arrears" | "custom";

export type PaymentTermsConfig = {
  display: string;
  netDays: number;
  holdDays: number;
  cadence: PaymentTermsCadence;
  /** Minimum payout batch size in dollars; 0 = no minimum. */
  minPayoutDollars: number;
};

export const DEFAULT_PAYMENT_TERMS_CONFIG: PaymentTermsConfig = {
  display: "Paid within 30 days",
  netDays: 30,
  holdDays: 0,
  cadence: "net",
  minPayoutDollars: 0,
};

function friendlyNetLabel(days: number): string {
  const n = Number.isFinite(days) && days >= 0 ? Math.floor(days) : 30;
  if (n === 0) return "Paid when due";
  if (n === 1) return "Paid within 1 day";
  return `Paid within ${n} days`;
}

/** Partner-facing schedule label (never show raw "Net 30"). */
export function friendlyPaymentTermsLabel(config: PaymentTermsConfig): string {
  if (config.cadence === "monthly_in_arrears") {
    return "Paid monthly (after the month ends)";
  }
  const fromDisplay = config.display.match(/net\s*[-]?\s*(\d+)/i);
  if (fromDisplay || config.cadence === "net") {
    const days = fromDisplay
      ? Number.parseInt(fromDisplay[1] ?? "30", 10)
      : config.netDays;
    return friendlyNetLabel(days);
  }
  const trimmed = config.display.trim();
  if (!trimmed || /^net\s/i.test(trimmed)) {
    return friendlyNetLabel(config.netDays);
  }
  return trimmed;
}

export function parsePaymentTerms(
  raw: string | null | undefined,
): PaymentTermsConfig {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { ...DEFAULT_PAYMENT_TERMS_CONFIG };

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<PaymentTermsConfig>;
      const netDays =
        typeof parsed.netDays === "number" && parsed.netDays >= 0
          ? parsed.netDays
          : DEFAULT_PAYMENT_TERMS_CONFIG.netDays;
      const holdDays =
        typeof parsed.holdDays === "number" && parsed.holdDays >= 0
          ? parsed.holdDays
          : 0;
      const minPayoutDollars =
        typeof parsed.minPayoutDollars === "number" &&
        parsed.minPayoutDollars >= 0
          ? parsed.minPayoutDollars
          : 0;
      const cadence: PaymentTermsCadence =
        parsed.cadence === "monthly_in_arrears" ||
        parsed.cadence === "custom" ||
        parsed.cadence === "net"
          ? parsed.cadence
          : "net";
      const display =
        (parsed.display?.trim() ||
          (cadence === "monthly_in_arrears"
            ? "Paid monthly (after the month ends)"
            : friendlyNetLabel(netDays))) ??
        DEFAULT_PAYMENT_TERMS_CONFIG.display;
      return { display, netDays, holdDays, cadence, minPayoutDollars };
    } catch {
      // fall through to legacy parse
    }
  }

  const netMatch = trimmed.match(/net\s*[-]?\s*(\d+)/i);
  const netDays = netMatch
    ? Number.parseInt(netMatch[1] ?? "30", 10)
    : DEFAULT_PAYMENT_TERMS_CONFIG.netDays;
  const holdMatch = trimmed.match(/hold\s*[-]?\s*(\d+)/i);
  const holdDays = holdMatch
    ? Number.parseInt(holdMatch[1] ?? "0", 10)
    : 0;
  const cadence: PaymentTermsCadence = /monthly\s*in\s*arrears/i.test(trimmed)
    ? "monthly_in_arrears"
    : "net";

  const resolvedDays = Number.isFinite(netDays) ? netDays : 30;
  return {
    display:
      cadence === "monthly_in_arrears"
        ? "Paid monthly (after the month ends)"
        : netMatch
          ? friendlyNetLabel(resolvedDays)
          : trimmed,
    netDays: resolvedDays,
    holdDays: Number.isFinite(holdDays) ? holdDays : 0,
    cadence,
    minPayoutDollars: 0,
  };
}

export function serializePaymentTerms(config: PaymentTermsConfig): string {
  return JSON.stringify({
    display:
      config.display.trim() ||
      (config.cadence === "monthly_in_arrears"
        ? "Paid monthly (after the month ends)"
        : friendlyNetLabel(config.netDays)),
    netDays: Math.max(0, Math.floor(config.netDays)),
    holdDays: Math.max(0, Math.floor(config.holdDays)),
    cadence: config.cadence,
    minPayoutDollars: Math.max(0, config.minPayoutDollars),
  });
}

/** Derive first payable date from payment terms (Net + hold). */
export function derivePayableDate(
  paymentTerms: string | null | undefined,
  fromDate: Date = new Date(),
): string {
  const config = parsePaymentTerms(paymentTerms);
  const payable = new Date(fromDate);
  const days = config.netDays + config.holdDays;
  if (config.cadence === "monthly_in_arrears") {
    // End of next calendar month + hold
    payable.setUTCMonth(payable.getUTCMonth() + 1, 1);
    payable.setUTCDate(0); // last day of next month's previous = end of target month
    // Simpler: add ~30 days then hold
    const base = new Date(fromDate);
    base.setUTCMonth(base.getUTCMonth() + 1);
    base.setUTCDate(0);
    const hold = new Date(base);
    hold.setUTCDate(hold.getUTCDate() + config.holdDays);
    return hold.toISOString().slice(0, 10);
  }
  if (days > 0) {
    payable.setUTCDate(payable.getUTCDate() + days);
  }
  return payable.toISOString().slice(0, 10);
}

export function isPayableDateReached(
  payableDate: string | null | undefined,
): boolean {
  if (!payableDate) return true;
  const target = Date.parse(`${payableDate}T23:59:59.999Z`);
  if (Number.isNaN(target)) return true;
  return Date.now() >= target;
}

export function paymentTermsDisplayLabel(
  paymentTerms: string | null | undefined,
): string {
  return friendlyPaymentTermsLabel(parsePaymentTerms(paymentTerms));
}
