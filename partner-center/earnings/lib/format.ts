import {
  programLabel as referralProgramLabel,
  titleCaseWords,
} from "@/partner-center/referrals/lib/format";

export {
  earningStatusLabel,
  earningStatusTone,
  formatMoney,
  formatShortDate,
  referralDisplayId,
  titleCaseWords,
} from "@/partner-center/referrals/lib/format";

export { referralProgramLabel };

/** Partner program family labels (commission rules / terms). */
export function programLabel(program: string): string {
  if (program === "academy") return "Academy";
  if (program === "platform" || program === "whitbyos" || program === "shared") {
    return "Whitby";
  }
  if (program === "enterprise") return "Enterprise";
  return program;
}

export function earningBasisLabel(basis: string | null | undefined): string {
  if (!basis?.trim()) return "—";
  const key = basis.trim().toLowerCase();
  if (key === "first_payment" || key === "first_collected_payment") {
    return "First payment";
  }
  if (key === "each_payment" || key === "each_collected_payment") {
    return "Each payment";
  }
  return titleCaseWords(basis);
}

export function eligiblePeriodLabel(period: string | null | undefined): string {
  if (!period?.trim()) return "—";
  const key = period.trim().toLowerCase();
  if (key === "one_payment" || key === "one_event" || key === "first_payment_only") {
    return "One payment only";
  }
  if (key === "three_months" || key === "3_months") return "Three months";
  if (key === "six_months" || key === "6_months") return "Six months";
  if (key === "twelve_months" || key === "12_months") return "Twelve months";
  return titleCaseWords(period);
}

export function rateDisplay(
  rateType: string | null | undefined,
  rateValue: number | string | null | undefined,
): string {
  const value = Number(rateValue);
  if (rateType === "flat") {
    return Number.isFinite(value) ? `$${value}` : "—";
  }
  if (!Number.isFinite(value)) return "—";
  return `${value}%`;
}

export function rateOfRevenueLabel(
  rateType: string | null | undefined,
  rateValue: number | string | null | undefined,
): string {
  const rate = rateDisplay(rateType, rateValue);
  if (rate === "—") return "—";
  if (rateType === "flat") return rate;
  return `${rate} of collected revenue`;
}

export function collectedAmountLabel(
  commission: number,
  rateType: string | null | undefined,
  rateValue: number | string | null | undefined,
): string {
  if (rateType !== "percentage") return "—";
  const rate = Number(rateValue);
  if (!Number.isFinite(rate) || rate <= 0) return "—";
  const collected = commission / (rate / 100);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(collected);
}

export function paymentSourceLabel(
  source: string | null | undefined,
  _ref?: string | null | undefined,
): string {
  const raw = source?.trim();
  if (!raw) return "—";
  const key = raw.toLowerCase();
  if (key === "quickbooks") return "QuickBooks";
  if (key === "stripe") return "Stripe";
  if (key === "manual") return "Manual";
  return titleCaseWords(raw);
}

export function sourceTitle(
  name: string | null | undefined,
  program: string | null | undefined,
): string {
  const programName = program ? referralProgramLabel(program) : "";
  const entity = name?.trim() || "";
  if (entity && programName) return `${entity} — ${programName}`;
  return entity || programName || "—";
}

export function contactDisplayName(contact: {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string | null {
  const preferred = contact.preferred_name?.trim();
  if (preferred) return preferred;
  const composed = [contact.first_name, contact.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return composed || null;
}
