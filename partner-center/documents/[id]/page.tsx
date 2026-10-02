import { redirect } from "next/navigation";
import { resolveDocumentUrl } from "@/base/lib/documents";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { DocumentDetailView } from "@/partner-center/documents/components/DocumentDetailView";
import { PartnerSignDocumentScreen } from "@/partner-center/documents/components/PartnerSignDocumentScreen";
import { loadDocumentDetail } from "@/partner-center/documents/lib/load-document-detail";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { PartnerAccessDenied } from "@/partner-center/components/states/PartnerAccessDenied";
import { PartnerNotFound } from "@/partner-center/components/states/PartnerNotFound";

export default async function PartnerDocumentDetailPage({
  documentId,
  searchParams,
}: {
  documentId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { user, context } = await requirePartnerAppAccess();
  if (!context?.profile) return <PartnerNotFound />;

  const loaded = await loadDocumentDetail(context, documentId, user.id);
  if (loaded.kind === "denied") {
    return (
      <PartnerAccessDenied description="You don't have permission to view this document." />
    );
  }
  if (loaded.kind !== "ok") return <PartnerNotFound />;

  const data = loaded.data;
  if (data.supersededByDocumentId) {
    redirect(`/partner-center/documents/${data.supersededByDocumentId}`);
  }

  const wantsSign =
    searchParams?.sign === "1" ||
    searchParams?.sign === "true" ||
    searchParams?.action === "sign";

  if (
    wantsSign &&
    data.canMutate &&
    data.status === "action_needed" &&
    data.neededAction === "sign_externally" &&
    data.fileUrl?.trim()
  ) {
    const supabase = await createClient();
    const { data: identity } = await supabase
      .from("users")
      .select("full_name, preferred_name")
      .eq("id", user.id)
      .maybeSingle();
    const defaultName = (
      (identity?.full_name as string) ||
      (identity?.preferred_name as string) ||
      ""
    ).trim();

    return (
      <PartnerSignDocumentScreen
        documentId={data.id}
        title={data.title}
        fileUrl={data.fileUrl}
        closeHref={`/partner-center/documents/${data.id}`}
        defaultName={defaultName}
      />
    );
  }

  if (wantsSign) {
    redirect(`/partner-center/documents/${data.id}`);
  }

  let previewUrl: string | null = null;

  if (isSupabaseConfigured() && data.fileUrl && !data.fileUrl.startsWith("/")) {
    const supabase = await createClient();
    previewUrl = await resolveDocumentUrl(supabase, data.fileUrl);
  }

  return (
    <DocumentDetailView data={data} previewUrl={previewUrl} />
  );
}
