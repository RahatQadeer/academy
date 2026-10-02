import {
  humanizeProductInterest,
  parseProductInterests,
} from "@/partner-center/opportunities/lib/product-interest-shared";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "accent";

export function productInterestLabel(
  value: string | null | undefined,
  options?: Array<{ value: string; label: string }>,
): string {
  if (!value) return "—";
  const parts = parseProductInterests(value);
  if (parts.length === 0) return "—";
  if (!options?.length) return humanizeProductInterest(value);
  return parts
    .map((part) => {
      const fromOptions = options.find((option) => option.value === part);
      return fromOptions?.label ?? humanizeProductInterest(part);
    })
    .join(", ");
}

export function statusLabel(status: string): string {
  if (status === "submitted") return "Submitted";
  if (status === "accepted") return "Accepted";
  if (status === "in_progress") return "In Progress";
  if (status === "converted") return "Converted";
  if (status === "not_moving_forward") return "Closed";
  return status;
}

export function statusTone(status: string): StatusTone {
  if (status === "submitted") return "neutral";
  if (status === "accepted") return "info";
  if (status === "in_progress") return "warning";
  if (status === "converted") return "success";
  if (status === "not_moving_forward") return "neutral";
  return "neutral";
}

/** Size label: seats vs users based on product interest. */
export function estimatedSizeLabel(
  seats: number | null | undefined,
  productInterest: string | null | undefined,
): string {
  if (seats == null || !Number.isFinite(seats)) return "—";
  const parts = parseProductInterests(productInterest);
  const academyOnly =
    parts.length === 1 &&
    (parts[0] === "academy" || parts[0] === "academy_seats");
  const unit = academyOnly
    ? seats === 1
      ? "seat"
      : "seats"
    : seats === 1
      ? "user"
      : "users";
  return `${seats} ${unit}`;
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

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function contactLine(
  name: string | null | undefined,
  title: string | null | undefined,
): string | null {
  const n = name?.trim();
  const t = title?.trim();
  if (!n && !t) return null;
  if (n && t) return `Contact: ${n}, ${t}`;
  if (n) return `Contact: ${n}`;
  return t ? `Contact: ${t}` : null;
}

export function contactDetailLabel(
  name: string | null | undefined,
  title: string | null | undefined,
): string {
  const n = name?.trim();
  const t = title?.trim();
  if (n && t) return `${n}, ${t}`;
  return n || t || "—";
}
