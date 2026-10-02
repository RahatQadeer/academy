import type { ActivityItem } from "@/partner-center/home/types";
import {
  earningStatusLabel,
  formatMoney,
} from "@/partner-center/referrals/lib/format";

type ReferralRow = {
  id: string;
  program: string;
  product: string | null;
  created_at: string;
  referral_date: string;
  contact_name: string | null;
};

type OpportunityRow = {
  id: string;
  created_at: string;
  company_name: string | null;
};

type EarningRow = {
  id: string;
  amount: number | string;
  status: string;
  created_at: string;
};

const ACTIVITY_LIMIT = 12;

function programLabel(program: string) {
  if (program === "platform" || program === "shared") return "Private Attaché";
  if (program === "whitbyos") return "Whitby";
  if (program === "academy") return "Academy";
  if (program === "enterprise") return "Enterprise";
  return program;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function relativeDayLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = startOfDay(new Date());
  const day = startOfDay(date);
  const diff = Math.round((today - day) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function buildActivityItems(input: {
  referrals: ReferralRow[];
  opportunities: OpportunityRow[];
  earnings: EarningRow[];
}): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const ref of input.referrals) {
    const at = ref.created_at || ref.referral_date;
    const name = ref.contact_name?.trim();
    const productBit = ref.product?.trim() || programLabel(ref.program);
    items.push({
      id: `ref-${ref.id}`,
      at,
      label: relativeDayLabel(at),
      parts: [
        { text: "New referral — " },
        {
          text: name ? `${productBit}, ${name}` : productBit,
          bold: true,
        },
      ],
    });
  }

  for (const opp of input.opportunities) {
    const at = opp.created_at;
    const name = opp.company_name?.trim() || "Enterprise opportunity";
    items.push({
      id: `opp-${opp.id}`,
      at,
      label: relativeDayLabel(at),
      parts: [
        { text: "Opportunity submitted — " },
        { text: name, bold: true },
      ],
    });
  }

  for (const earn of input.earnings) {
    const at = earn.created_at;
    const amount = Number(earn.amount) || 0;
    const statusLabel = earningStatusLabel(earn.status);
    items.push({
      id: `earn-${earn.id}`,
      at,
      label: relativeDayLabel(at),
      parts: [
        { text: "Earning recorded — " },
        { text: formatMoney(amount), bold: true },
        { text: ` (${statusLabel})` },
      ],
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return items.slice(0, ACTIVITY_LIMIT);
}
