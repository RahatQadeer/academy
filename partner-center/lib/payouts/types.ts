export type RunStripePayoutResult = {
  ok: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  payoutId?: string;
  transferId?: string;
  amount?: number;
  earningIds?: string[];
};
