import { PartnerLoadError } from "@/partner-center/components/states/PartnerLoadError";
import { LinksView } from "@/partner-center/links/components/LinksView";
import { loadLinks } from "@/partner-center/links/lib/load-links";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";

export async function LinksPageContent() {
  const { context } = await requirePartnerAppAccess();
  const result = await loadLinks(context);
  if (!result.ok) {
    return (
      <PartnerLoadError retryHref="/partner-center/links" message={result.error} />
    );
  }
  return <LinksView data={result.data} />;
}
