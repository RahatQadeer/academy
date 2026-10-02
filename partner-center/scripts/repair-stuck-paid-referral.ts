/**
 * One-off repair for stuck Whitby paid referrals (convert + earning).
 *
 * Usage (from repo root, with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set):
 *   npx --yes tsx --tsconfig tsconfig.json partner-center/scripts/repair-stuck-paid-referral.ts [referralId]
 *
 * Default referralId: 2641e0c7-d5af-4c0f-95fb-864fc538d2cb (bosog66527@duidir.com Whitby test)
 */
import { createClient } from "@supabase/supabase-js";
import { repairStuckPaidReferral } from "../lib/attribution/repair-stuck-paid-referral";
import { promoteEarningsToPayable } from "../lib/attribution/promote-payable";

const DEFAULT_REFERRAL_ID = "2641e0c7-d5af-4c0f-95fb-864fc538d2cb";

async function main() {
  const referralId = process.argv[2]?.trim() || DEFAULT_REFERRAL_ID;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await repairStuckPaidReferral(supabase, referralId);
  console.log(JSON.stringify(result, null, 2));

  if (result.ok && result.referralId) {
    const { data: profile } = await supabase
      .from("partner_referrals")
      .select("partner_profile_id")
      .eq("id", result.referralId)
      .maybeSingle();
    if (profile?.partner_profile_id) {
      await promoteEarningsToPayable(
        supabase,
        profile.partner_profile_id as string,
      );
      console.log("promoteEarningsToPayable done for", profile.partner_profile_id);
    }
  }

  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
