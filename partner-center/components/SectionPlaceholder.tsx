import { PartnerChrome } from "@/partner-center/components/PartnerChrome";

/** Lightweight screen for nav items that are not built yet. */
export function SectionPlaceholder({
  title,
  blurb,
}: {
  title: string;
  blurb?: string;
}) {
  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome
        title={title}
        subtitle={blurb ?? "This section is not available yet."}
      />
    </div>
  );
}
