"use client";

import { PartnerChrome } from "@/partner-center/components/PartnerChrome";

export function HomeHeader({
  companyName,
}: {
  companyName: string;
}) {
  return <PartnerChrome title="Home" subtitle={companyName} />;
}
