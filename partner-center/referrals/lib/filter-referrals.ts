import type {
  ReferralListFilters,
  ReferralListItem,
} from "@/partner-center/referrals/types";

function rangeCutoff(range: ReferralListFilters["range"]): Date | null {
  if (range === "all") return null;
  const days = Number(range);
  if (!Number.isFinite(days)) return null;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

export function matchesReferralFilters(
  item: ReferralListItem,
  filters: ReferralListFilters,
): boolean {
  if (filters.status !== "all" && item.status !== filters.status) return false;
  if (filters.program !== "all") {
    if (filters.program === "platform") {
      if (item.program !== "platform" && item.program !== "shared") {
        return false;
      }
    } else if (item.program !== filters.program) {
      return false;
    }
  }

  const cutoff = rangeCutoff(filters.range);
  if (cutoff) {
    const stamp = new Date(
      item.referralDate.includes("T")
        ? item.referralDate
        : `${item.referralDate}T12:00:00`,
    );
    if (Number.isNaN(stamp.getTime()) || stamp < cutoff) return false;
  }

  if (filters.q) {
    const haystack = [
      item.id,
      item.displayId,
      item.contactName,
      item.companyName,
      item.program,
      item.product,
      item.sourceLabel,
      item.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filters.q.toLowerCase())) return false;
  }

  return true;
}
