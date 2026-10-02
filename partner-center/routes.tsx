import PartnerPage from "@/partner-center/page";
import PartnerSignIn from "@/partner-center/auth/signin/page";
import PartnerApply from "@/partner-center/auth/apply/page";
import PartnerForgotPassword from "@/partner-center/auth/forgot-password/page";
import PartnerResetPassword from "@/partner-center/auth/reset-password/page";
import PartnerCheckEmail from "@/partner-center/auth/check-email/page";
import PartnerConfirmed from "@/partner-center/auth/confirmed/page";
import PartnerAdminSignIn from "@/partner-center/admin/signin/page";
import PartnerAdminSignUp from "@/partner-center/admin/signup/page";
import PartnerAdminForgotPassword from "@/partner-center/admin/forgot-password/page";
import PartnerAdminResetPassword from "@/partner-center/admin/reset-password/page";
import PartnerOnboarding from "@/partner-center/onboarding/page";
import PartnerSubmitted from "@/partner-center/onboarding/submitted/page";
import PartnerPending from "@/partner-center/onboarding/pending/page";
import PartnerMoreInfo from "@/partner-center/onboarding/more-info/page";
import PartnerApproved from "@/partner-center/onboarding/approved/page";
import PartnerDeclined from "@/partner-center/onboarding/declined/page";
import PartnerAgreement from "@/partner-center/onboarding/agreement/page";
import PartnerAgreementSigned from "@/partner-center/onboarding/agreement/signed/page";
import PartnerAgreementView from "@/partner-center/onboarding/agreement/view/page";
import PartnerChecklist from "@/partner-center/onboarding/checklist/page";
import PartnerCompany from "@/partner-center/onboarding/company/page";
import PartnerContact from "@/partner-center/onboarding/contact/page";
import PartnerPrograms from "@/partner-center/onboarding/programs/page";
import PartnerGuide from "@/partner-center/onboarding/guide/page";
import PartnerTax from "@/partner-center/onboarding/tax/page";
import PartnerPayout from "@/partner-center/onboarding/payout/page";
import PartnerPayoutStripe from "@/partner-center/onboarding/payout/stripe/page";
import PartnerAppPayout from "@/partner-center/payout/page";
import PartnerComplete from "@/partner-center/onboarding/complete/page";
import PartnerReferralSetup from "@/partner-center/onboarding/referral/page";
import PartnerReferrals from "@/partner-center/referrals/page";
import PartnerReferralDetail from "@/partner-center/referrals/[id]/page";
import PartnerOpportunities from "@/partner-center/opportunities/page";
import PartnerSubmitOpportunity from "@/partner-center/opportunities/new/page";
import PartnerOpportunityDetail from "@/partner-center/opportunities/[id]/page";
import PartnerOpportunityAttachment from "@/partner-center/opportunities/[id]/attachment/page";
import PartnerEditOpportunity from "@/partner-center/opportunities/[id]/edit/page";
import PartnerEarnings from "@/partner-center/earnings/page";
import PartnerAllEarnings from "@/partner-center/earnings/all/page";
import PartnerEarningDetail from "@/partner-center/earnings/[id]/page";
import PartnerLinks from "@/partner-center/links/page";
import PartnerTeam from "@/partner-center/team/page";
import PartnerDocuments from "@/partner-center/documents/page";
import PartnerDocumentDetail from "@/partner-center/documents/[id]/page";
import PartnerProgramTerms from "@/partner-center/documents/terms/page";
import PartnerMessages from "@/partner-center/messages/page";
import PartnerInvitePage from "@/partner-center/auth/invite/[token]/page";
import PartnerSettingsProfile from "@/partner-center/settings/profile/page";
import PartnerSettingsNotifications from "@/partner-center/settings/notifications/page";
import PartnerSettingsSecurity from "@/partner-center/settings/security/page";
import PartnerSettingsTax from "@/partner-center/settings/tax/page";
import PartnerSettingsTaxSetup from "@/partner-center/settings/tax/setup/page";
import PartnerSettingsTaxStripe from "@/partner-center/settings/tax/stripe/page";
import { redirect } from "next/navigation";
import { PartnerNotFound } from "@/partner-center/components/states/PartnerNotFound";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import { syncSettingsStripeStatus } from "@/partner-center/settings/lib/tax-actions";
import { syncChecklistStripeStatus } from "@/partner-center/lib/checklist-actions";

type SearchParams = Record<string, string | string[] | undefined>;

export const PARTNER_SLUGS = [
  ["signin"],
  ["apply"],
  ["forgot-password"],
  ["reset-password"],
  ["check-email"],
  ["confirmed"],
  ["tax"],
  ["payout"],
  ["payout", "stripe"],
  ["referrals"],
  ["opportunities"],
  ["opportunities", "new"],
  ["earnings"],
  ["earnings", "all"],
  ["links"],
  ["team"],
  ["documents"],
  ["documents", "terms"],
  ["messages"],
  ["settings"],
  ["settings", "profile"],
  ["settings", "notifications"],
  ["settings", "security"],
  ["settings", "tax"],
  ["settings", "tax", "setup"],
  ["settings", "tax", "stripe"],
  ["settings", "tax", "stripe", "return"],
  ["settings", "tax", "stripe", "refresh"],
  ["onboarding"],
  ["onboarding", "submitted"],
  ["onboarding", "pending"],
  ["onboarding", "more-info"],
  ["onboarding", "approved"],
  ["onboarding", "declined"],
  ["onboarding", "agreement"],
  ["onboarding", "agreement", "signed"],
  ["onboarding", "agreement", "view"],
  ["onboarding", "checklist"],
  ["onboarding", "company"],
  ["onboarding", "contact"],
  ["onboarding", "programs"],
  ["onboarding", "guide"],
  ["onboarding", "tax"],
  ["onboarding", "payout"],
  ["onboarding", "payout", "stripe"],
  ["onboarding", "payout", "stripe", "return"],
  ["onboarding", "payout", "stripe", "refresh"],
  ["onboarding", "referral"],
  ["onboarding", "complete"],
];

const REFERRAL_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OPPORTUNITY_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EARNING_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DOCUMENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolvePartnerRoute(
  path: string,
  query: SearchParams,
) {
  // Partner Admin staff surface (separate from partner product).
  // Dynamic imports keep Super Admin client views out of the partner product
  // static graph (Turbopack otherwise fails module factory for those screens).
  if (path === "admin" || path.startsWith("admin/")) {
    const rest = path === "admin" ? "" : path.slice("admin/".length);
    if (rest === "signin") {
      return <PartnerAdminSignIn searchParams={Promise.resolve(query)} />;
    }
    if (rest === "signup") {
      return <PartnerAdminSignUp searchParams={Promise.resolve(query)} />;
    }
    if (rest === "forgot-password") return <PartnerAdminForgotPassword />;
    if (rest === "reset-password") return <PartnerAdminResetPassword />;
    if (!rest) {
      const { default: Page } = await import("@/partner-center/admin/page");
      return <Page />;
    }
    if (rest === "applications") {
      const { default: Page } = await import(
        "@/partner-center/admin/applications/page"
      );
      return <Page searchParams={query} />;
    }
    if (rest.startsWith("applications/")) {
      const id = rest.slice("applications/".length);
      if (REFERRAL_ID_RE.test(id) && !id.includes("/")) {
        const { default: Page } = await import(
          "@/partner-center/admin/applications/[id]/page"
        );
        return <Page params={Promise.resolve({ id })} />;
      }
    }
    if (rest === "partners") {
      const { default: Page } = await import(
        "@/partner-center/admin/partners/page"
      );
      return <Page />;
    }
    if (rest.startsWith("partners/")) {
      const id = rest.slice("partners/".length);
      if (REFERRAL_ID_RE.test(id) && !id.includes("/")) {
        const { default: Page } = await import(
          "@/partner-center/admin/partners/[id]/page"
        );
        return <Page params={Promise.resolve({ id })} />;
      }
    }
    if (rest === "referrals") {
      const { default: Page } = await import(
        "@/partner-center/admin/referrals/page"
      );
      return <Page searchParams={query} />;
    }
    if (rest.startsWith("referrals/")) {
      const id = rest.slice("referrals/".length);
      if (REFERRAL_ID_RE.test(id) && !id.includes("/")) {
        const { default: Page } = await import(
          "@/partner-center/admin/referrals/[id]/page"
        );
        return <Page params={Promise.resolve({ id })} />;
      }
    }
    if (rest === "opportunities") {
      const { default: Page } = await import(
        "@/partner-center/admin/opportunities/page"
      );
      return <Page searchParams={query} />;
    }
    if (rest.startsWith("opportunities/")) {
      const id = rest.slice("opportunities/".length);
      if (REFERRAL_ID_RE.test(id) && !id.includes("/")) {
        const { default: Page } = await import(
          "@/partner-center/admin/opportunities/[id]/page"
        );
        return <Page params={Promise.resolve({ id })} />;
      }
    }
    if (rest === "payouts") {
      const { default: Page } = await import(
        "@/partner-center/admin/payouts/page"
      );
      return <Page />;
    }
    if (rest === "commission") {
      const { default: Page } = await import(
        "@/partner-center/admin/commission/page"
      );
      return <Page />;
    }
    if (rest === "messages") {
      const { default: Page } = await import(
        "@/partner-center/admin/messages/page"
      );
      return <Page />;
    }
    if (rest.startsWith("messages/")) {
      const id = rest.slice("messages/".length);
      if (REFERRAL_ID_RE.test(id) && !id.includes("/")) {
        const { default: Page } = await import(
          "@/partner-center/admin/messages/[id]/page"
        );
        return <Page params={Promise.resolve({ id })} />;
      }
    }
    return <PartnerNotFound />;
  }

  if (path === "signin") {
    const err = typeof query.error === "string" ? query.error : undefined;
    return <PartnerSignIn error={err} />;
  }
  if (path.startsWith("invite/")) {
    const token = path.slice("invite/".length);
    if (token && !token.includes("/")) {
      return <PartnerInvitePage params={Promise.resolve({ token })} />;
    }
  }
  if (path === "apply") return <PartnerApply />;
  if (path === "forgot-password") return <PartnerForgotPassword />;
  if (path === "reset-password") return <PartnerResetPassword />;
  if (path === "check-email") {
    const email = typeof query.email === "string" ? query.email : undefined;
    return <PartnerCheckEmail email={email} />;
  }
  if (path === "confirmed") {
    const err = typeof query.error === "string" ? query.error : undefined;
    return <PartnerConfirmed error={err} />;
  }
  if (path === "tax") redirect(PARTNER_PATHS.settingsTax);
  if (path === "payout") return <PartnerAppPayout />;
  if (path === "payout/stripe") redirect(PARTNER_PATHS.settingsTaxStripe);
  if (path === "referrals") {
    return <PartnerReferrals searchParams={query} />;
  }
  if (path === "opportunities") {
    return <PartnerOpportunities searchParams={query} />;
  }
  if (path === "opportunities/new") return <PartnerSubmitOpportunity />;
  if (path === "earnings") {
    return <PartnerEarnings searchParams={query} />;
  }
  if (path === "earnings/all") {
    return <PartnerAllEarnings searchParams={query} />;
  }
  if (path === "links") {
    return <PartnerLinks />;
  }
  if (path === "team") return <PartnerTeam searchParams={query} />;
  if (path === "documents") {
    return <PartnerDocuments searchParams={query} />;
  }
  if (path === "documents/terms") {
    return <PartnerProgramTerms searchParams={query} />;
  }
  if (path.startsWith("documents/")) {
    const id = path.slice("documents/".length);
    if (DOCUMENT_ID_RE.test(id) && !id.includes("/")) {
      return (
        <PartnerDocumentDetail documentId={id} searchParams={query} />
      );
    }
  }
  if (path === "messages") {
    return <PartnerMessages searchParams={query} />;
  }
  if (path === "settings") redirect(PARTNER_PATHS.settingsProfile);
  if (path === "settings/profile") return <PartnerSettingsProfile />;
  if (path === "settings/notifications") return <PartnerSettingsNotifications />;
  if (path === "settings/security") return <PartnerSettingsSecurity />;
  if (path === "settings/tax") return <PartnerSettingsTax />;
  if (path === "settings/tax/setup") return <PartnerSettingsTaxSetup />;
  if (path === "settings/tax/stripe") {
    return <PartnerSettingsTaxStripe searchParams={Promise.resolve(query)} />;
  }
  if (path === "settings/tax/stripe/return") {
    // Must not revalidatePath during render — redirect loads fresh Tax data.
    const result = await syncSettingsStripeStatus({ revalidate: false });
    if (result.error) {
      redirect(
        `${PARTNER_PATHS.settingsTaxStripe}?error=${encodeURIComponent(result.error)}`,
      );
    }
    redirect(result.redirect || PARTNER_PATHS.settingsTax);
  }
  if (path === "settings/tax/stripe/refresh") {
    redirect("/api/partner-center/stripe/connect");
  }
  if (path.startsWith("referrals/")) {
    const id = path.slice("referrals/".length);
    if (REFERRAL_ID_RE.test(id) && !id.includes("/")) {
      return <PartnerReferralDetail referralId={id} />;
    }
  }
  if (path.startsWith("opportunities/")) {
    const rest = path.slice("opportunities/".length);
    const attachmentMatch = rest.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/attachment$/i,
    );
    if (attachmentMatch) {
      return (
        <PartnerOpportunityAttachment opportunityId={attachmentMatch[1]} />
      );
    }
    const editMatch = rest.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/edit$/i,
    );
    if (editMatch) {
      return <PartnerEditOpportunity opportunityId={editMatch[1]} />;
    }
    if (OPPORTUNITY_ID_RE.test(rest) && !rest.includes("/")) {
      return <PartnerOpportunityDetail opportunityId={rest} />;
    }
  }
  if (path.startsWith("earnings/")) {
    const id = path.slice("earnings/".length);
    if (EARNING_ID_RE.test(id) && !id.includes("/")) {
      return <PartnerEarningDetail earningId={id} />;
    }
  }
  if (path === "onboarding") return <PartnerOnboarding />;
  if (path === "onboarding/submitted") return <PartnerSubmitted />;
  if (path === "onboarding/pending") return <PartnerPending />;
  if (path === "onboarding/more-info") return <PartnerMoreInfo />;
  if (path === "onboarding/approved") return <PartnerApproved />;
  if (path === "onboarding/declined") return <PartnerDeclined />;
  if (path === "onboarding/agreement") return <PartnerAgreement />;
  if (path === "onboarding/agreement/signed") return <PartnerAgreementSigned />;
  if (path === "onboarding/agreement/view") return <PartnerAgreementView />;
  if (path === "onboarding/checklist") return <PartnerChecklist />;
  if (path === "onboarding/company") return <PartnerCompany />;
  if (path === "onboarding/contact") return <PartnerContact />;
  if (path === "onboarding/programs") return <PartnerPrograms />;
  if (path === "onboarding/guide") return <PartnerGuide />;
  if (path === "onboarding/tax") return <PartnerTax />;
  if (path === "onboarding/payout") return <PartnerPayout />;
  if (path === "onboarding/payout/stripe") return <PartnerPayoutStripe />;
  if (path === "onboarding/payout/stripe/return") {
    const result = await syncChecklistStripeStatus();
    if (result.error) {
      redirect(
        `${PARTNER_PATHS.payoutStripe}?error=${encodeURIComponent(result.error)}`,
      );
    }
    redirect(result.redirect || PARTNER_PATHS.checklist);
  }
  if (path === "onboarding/payout/stripe/refresh") {
    redirect("/api/partner-center/stripe/connect");
  }
  if (path === "onboarding/referral") return <PartnerReferralSetup />;
  if (path === "onboarding/complete") return <PartnerComplete />;
  if (!path) return <PartnerPage searchParams={query} />;
  return <PartnerNotFound />;
}
