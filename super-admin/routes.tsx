import ApplicationsAdminPage from "@/super-admin/partner-center/applications/page";
import ApplicationDetailAdminPage from "@/super-admin/partner-center/applications/[id]/page";
import OpportunitiesAdminPage from "@/super-admin/partner-center/opportunities/page";
import OpportunityDetailAdminPage from "@/super-admin/partner-center/opportunities/[id]/page";
import AdminOpportunityAttachmentPage from "@/super-admin/partner-center/opportunities/[id]/attachment/page";
import ReferralsAdminPage from "@/super-admin/partner-center/referrals/page";
import CreateReferralAdminPage from "@/super-admin/partner-center/referrals/new/page";
import ReferralDetailAdminPage from "@/super-admin/partner-center/referrals/[id]/page";
import PayoutsAdminPage from "@/super-admin/partner-center/payouts/page";
import PartnersAdminPage from "@/super-admin/partner-center/partners/page";
import PartnerDetailAdminPage from "@/super-admin/partner-center/partners/[id]/page";
import PartnerTermsAdminPage from "@/super-admin/partner-center/partners/[id]/terms/page";
import PartnerDocumentsAdminPage from "@/super-admin/partner-center/partners/[id]/documents/page";
import PartnerDocumentDetailAdminPage from "@/super-admin/partner-center/partners/[id]/documents/[docId]/page";
import MessagesAdminPage from "@/super-admin/partner-center/messages/page";
import MessageThreadAdminPage from "@/super-admin/partner-center/messages/[id]/page";
import ProgramConfigAdminPage from "@/super-admin/partner-center/program-config/page";
import Tax1099AdminPage from "@/super-admin/partner-center/tax-1099/page";
import PartnerCenterAdminPage from "@/super-admin/partner-center/page";
import SuperAdminHubPage from "@/super-admin/page";
import ClientPortalAdminPage from "@/super-admin/client-portal/page";
import SuperAdminUsersPage from "@/super-admin/users/page";
import { SuperAdminNotFound } from "@/super-admin/components/SuperAdminNotFound";

type SearchParams = Record<string, string | string[] | undefined>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveSuperAdminRoute(path: string, query: SearchParams = {}) {
  // Sign-in is a real App Router page under (auth)/signin — not this catch-all.
  if (path === "signin") {
    return <SuperAdminNotFound />;
  }

  if (!path) return <SuperAdminHubPage />;

  if (path === "users") return <SuperAdminUsersPage />;

  if (path === "client-portal") return <ClientPortalAdminPage />;

  if (path === "partner-center") return <PartnerCenterAdminPage />;
  if (path === "partner-center/applications") {
    return <ApplicationsAdminPage searchParams={query} />;
  }
  if (path.startsWith("partner-center/applications/")) {
    const id = path.slice("partner-center/applications/".length);
    if (UUID_RE.test(id) && !id.includes("/")) {
      return <ApplicationDetailAdminPage params={Promise.resolve({ id })} />;
    }
  }

  if (path === "partner-center/partners") return <PartnersAdminPage />;
  if (path.startsWith("partner-center/partners/")) {
    const rest = path.slice("partner-center/partners/".length);
    const termsMatch = rest.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/terms$/i,
    );
    if (termsMatch) {
      return (
        <PartnerTermsAdminPage
          params={Promise.resolve({ id: termsMatch[1] })}
        />
      );
    }
    const documentsMatch = rest.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/documents$/i,
    );
    if (documentsMatch) {
      return (
        <PartnerDocumentsAdminPage
          params={Promise.resolve({ id: documentsMatch[1] })}
        />
      );
    }
    const documentDetailMatch = rest.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/documents\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
    );
    if (documentDetailMatch) {
      return (
        <PartnerDocumentDetailAdminPage
          params={Promise.resolve({
            id: documentDetailMatch[1],
            docId: documentDetailMatch[2],
          })}
          searchParams={query}
        />
      );
    }
    if (UUID_RE.test(rest) && !rest.includes("/")) {
      return (
        <PartnerDetailAdminPage
          params={Promise.resolve({ id: rest })}
          searchParams={query}
        />
      );
    }
  }

  if (path === "partner-center/referrals") {
    return <ReferralsAdminPage searchParams={query} />;
  }
  if (path === "partner-center/referrals/new") {
    return <CreateReferralAdminPage />;
  }
  if (path.startsWith("partner-center/referrals/")) {
    const id = path.slice("partner-center/referrals/".length);
    if (UUID_RE.test(id) && !id.includes("/")) {
      return <ReferralDetailAdminPage params={Promise.resolve({ id })} />;
    }
  }

  if (path === "partner-center/opportunities") {
    return <OpportunitiesAdminPage searchParams={query} />;
  }
  if (path.startsWith("partner-center/opportunities/")) {
    const rest = path.slice("partner-center/opportunities/".length);
    const attachmentMatch = rest.match(
      /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/attachment$/i,
    );
    if (attachmentMatch) {
      return (
        <AdminOpportunityAttachmentPage
          params={Promise.resolve({ id: attachmentMatch[1] })}
        />
      );
    }
    if (UUID_RE.test(rest) && !rest.includes("/")) {
      return (
        <OpportunityDetailAdminPage
          params={Promise.resolve({ id: rest })}
          searchParams={query}
        />
      );
    }
  }

  if (path === "partner-center/payouts") {
    return <PayoutsAdminPage />;
  }

  if (path === "partner-center/messages") {
    return <MessagesAdminPage />;
  }
  if (path.startsWith("partner-center/messages/")) {
    const id = path.slice("partner-center/messages/".length);
    if (UUID_RE.test(id) && !id.includes("/")) {
      return <MessageThreadAdminPage params={Promise.resolve({ id })} />;
    }
  }

  if (path === "partner-center/program-config") {
    return <ProgramConfigAdminPage searchParams={query} />;
  }

  if (path === "partner-center/tax-1099") {
    return <Tax1099AdminPage searchParams={query} />;
  }

  return <SuperAdminNotFound />;
}
