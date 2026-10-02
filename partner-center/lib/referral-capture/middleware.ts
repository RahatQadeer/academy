import type { NextRequest, NextResponse } from "next/server";
import { captureReferralFromParam } from "@/partner-center/lib/referral-capture/capture-referral";
import { REFERRAL_COOKIE_NAME } from "@/partner-center/lib/referral-capture/constants";
import { isAcademyNext } from "@/base/auth/query";
import { isSharedReferralDestination } from "@/partner-center/lib/referral-url";

function captureScopeFromRequest(
  next: string | null,
  brand: string | null,
): "shared" | "academy" | "whitbyos" {
  if (isSharedReferralDestination(next, brand)) return "shared";

  const brandKey = brand?.trim().toLowerCase() ?? "";
  const path = next?.trim() ?? "";

  if (
    brandKey === "whitbyos" ||
    brandKey === "whitby" ||
    brandKey === "platform" ||
    path.startsWith("/whitbyos")
  ) {
    return "whitbyos";
  }

  if (brandKey === "academy" || isAcademyNext(path)) {
    return "academy";
  }

  // Ambiguous brand/next — stay product-neutral (UI "Whitby" until product entry).
  return "shared";
}

export async function applyReferralCaptureToResponse(
  request: NextRequest,
  response: NextResponse,
  ref: string,
): Promise<NextResponse> {
  const brand = request.nextUrl.searchParams.get("brand");
  const next = request.nextUrl.searchParams.get("next");
  const scope = captureScopeFromRequest(next, brand);
  const spec = await captureReferralFromParam(
    ref,
    undefined,
    scope,
    request.cookies.get(REFERRAL_COOKIE_NAME)?.value,
  );
  if (!spec) return response;

  response.cookies.set(spec.name, spec.value, {
    maxAge: spec.maxAge,
    httpOnly: spec.httpOnly,
    sameSite: spec.sameSite,
    path: spec.path,
  });

  return response;
}
