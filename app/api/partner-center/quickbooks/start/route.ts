import { NextResponse } from "next/server";
import { siteUrl } from "@/base/auth/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Legacy path — prefer `/api/super-admin/quickbooks/start` (staff API, no product login). */
export async function GET() {
  return NextResponse.redirect(
    new URL("/api/super-admin/quickbooks/start", siteUrl()),
  );
}
