import type { Metadata } from "next";
import { PlatformPage } from "@/base/landing/platform/PlatformPage";
import { PLATFORM_OVERVIEW } from "@/base/landing/platform";

export const metadata: Metadata = {
  title: `Platform — Private Attaché`,
  description: PLATFORM_OVERVIEW.lede,
};

export default function PlatformOverviewPage() {
  return <PlatformPage />;
}
