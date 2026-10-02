import { redirect } from "next/navigation";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

/** Legacy URL — Programs & terms now lives on the partner detail mini-sidebar. */
export default async function PartnerTermsAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(PC_ADMIN.partnerSection(id, "terms"));
  return null;
}
