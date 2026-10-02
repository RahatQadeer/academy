export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "accent";

/** Short public id for tables and headers (7 alphanumeric chars). */
export function referralDisplayId(id: string): string {
  const compact = id.replace(/-/g, "").toLowerCase();
  return compact.slice(0, 7) || id.slice(0, 7);
}

export function programLabel(program: string): string {
  if (program === "platform" || program === "shared") return "Private Attaché";
  if (program === "whitbyos") return "Whitby";
  if (program === "academy") return "Academy";
  if (program === "enterprise") return "Enterprise";
  return program;
}

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  const key = source.toLowerCase();
  if (key === "link" || key === "referral_link") return "Referral link";
  if (key === "code" || key === "access_code") return "Access code";
  if (key === "campaign" || key === "campaign_event") return "Campaign";
  if (key === "manual") return "Manual";
  if (key === "admin") return "Admin";
  return titleCaseWords(source);
}

/** Title-case words; turns snake_case / kebab-case into plain words. */
export function titleCaseWords(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Partner-facing label for attribution qualifying_action values. */
export function qualifyingActionLabel(action: string | null | undefined): string {
  const key = (action ?? "").trim().toLowerCase();
  if (!key) return "—";
  if (key === "paid_enrollment") return "Paid enrollment completed";
  if (key === "free_enrollment") return "Free enrollment completed";
  if (key === "first_paid_subscription") {
    return "First paid subscription collected";
  }
  if (key === "enterprise_payment_collected") {
    return "Enterprise payment collected";
  }
  if (key === "trial_started" || key === "subscription_trialing") {
    return "Trial started";
  }
  return titleCaseWords(key);
}

export function statusLabel(status: string): string {
  if (status === "referred") return "Referred";
  if (status === "in_progress") return "In Progress";
  if (status === "converted") return "Converted";
  if (status === "not_converted") return "Not Converted";
  return titleCaseWords(status);
}

export function statusTone(status: string): StatusTone {
  if (status === "referred") return "info";
  if (status === "in_progress") return "warning";
  if (status === "converted") return "success";
  if (status === "not_converted") return "neutral";
  return "neutral";
}

export function earningStatusLabel(status: string): string {
  if (status === "pending") return "Pending";
  if (status === "approved") return "Approved";
  if (status === "payable") return "Payable";
  if (status === "paid") return "Paid";
  if (status === "held") return "Held";
  if (status === "payout_locked") return "Payout in progress";
  if (status === "reversed") return "Reversed";
  if (status === "ineligible") return "Ineligible";
  return titleCaseWords(status);
}

export function earningStatusTone(status: string): StatusTone {
  if (status === "pending") return "warning";
  if (status === "approved") return "info";
  if (status === "payable") return "neutral";
  if (status === "payout_locked") return "info";
  if (status === "paid") return "success";
  if (status === "held" || status === "reversed" || status === "ineligible") {
    return "danger";
  }
  return "neutral";
}

export function formatShortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatShortDate(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRateLabel(
  rateType: string | null | undefined,
  rateValue: number | string | null | undefined,
  program: string,
): string {
  const value = Number(rateValue);
  if (!Number.isFinite(value) && rateType !== "flat") {
    return `— — ${programLabel(program)}`;
  }
  const rate =
    rateType === "flat"
      ? `$${Number.isFinite(value) ? value : 0}`
      : `${value}%`;
  return `${rate} — ${programLabel(program)}`;
}

export function basisLabel(basis: string | null | undefined): string {
  if (!basis) return "First collected payment";
  if (basis === "first_payment" || basis === "first_collected_payment") {
    return "First collected payment";
  }
  return titleCaseWords(basis);
}

export function addDays(isoDate: string, days: number): Date | null {
  const base = new Date(
    isoDate.includes("T") ? isoDate : `${isoDate}T12:00:00`,
  );
  if (Number.isNaN(base.getTime())) return null;
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
}
