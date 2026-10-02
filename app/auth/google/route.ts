import { startOAuth } from "@/base/auth/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const next = new URL(request.url).searchParams.get("next") || "/switcher";
  return startOAuth("google", next);
}
