import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePageView } from "@/base/landing/modules/ModulePageView";
import {
  MODULE_PAGES,
  MODULE_SLUGS,
  isModuleSlug,
  type ModuleSlug,
} from "@/base/landing/modules";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return MODULE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isModuleSlug(slug)) {
    return { title: "Module — Private Attaché" };
  }
  const page = MODULE_PAGES[slug];
  return {
    title: `${page.title} — Private Attaché`,
    description: page.lede,
  };
}

export default async function ModulePage({ params }: PageProps) {
  const { slug } = await params;
  if (!isModuleSlug(slug)) notFound();
  return <ModulePageView slug={slug as ModuleSlug} />;
}
