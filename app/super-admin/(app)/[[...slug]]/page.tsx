import { resolveSuperAdminRoute } from "@/super-admin/routes";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SuperAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const path = (slug ?? []).join("/");
  return resolveSuperAdminRoute(path, query);
}
