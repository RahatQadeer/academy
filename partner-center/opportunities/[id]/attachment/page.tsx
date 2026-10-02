import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { PartnerNotFound } from "@/partner-center/components/states/PartnerNotFound";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";

const BUCKET = "documents";

export default async function PartnerOpportunityAttachmentPage({
  opportunityId,
}: {
  opportunityId: string;
}) {
  const { context } = await requirePartnerAppAccess();
  const profile = context?.profile;

  if (!profile || !isSupabaseConfigured() || !opportunityId) {
    return <PartnerNotFound />;
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("partner_opportunities")
    .select("id, attachment_document_id")
    .eq("partner_profile_id", profile.id)
    .eq("id", opportunityId)
    .maybeSingle();

  const documentId = row?.attachment_document_id as string | null | undefined;
  if (!documentId) return <PartnerNotFound />;

  const reader = createAdminClient() ?? supabase;
  const { data: document } = await reader
    .from("documents")
    .select("id, file_url")
    .eq("id", documentId)
    .maybeSingle();

  const fileUrl = (document?.file_url as string | null)?.trim();
  if (!fileUrl) return <PartnerNotFound />;

  const { data: signed, error } = await reader.storage
    .from(BUCKET)
    .createSignedUrl(fileUrl, 60);

  if (error || !signed?.signedUrl) return <PartnerNotFound />;

  redirect(signed.signedUrl);
  return null;
}
