import SuperAdminSignInPage from "@/super-admin/auth/signin/page";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return <SuperAdminSignInPage searchParams={searchParams} />;
}
