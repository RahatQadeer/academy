# Referral capture — integration handoffs (Laiba / base)

The module in this folder is testable in isolation, but **not live end-to-end** until the three hooks below are wired. All three files are outside `partner-center/` scope.

For Monday demo: if Supabase signup returns an immediate session (user lands straight in the app), **Handoffs 1 + 2** cover password signup. Handoff 3 is required for OAuth and for email-confirm flows where the cookie survives the confirm click.

---

## Handoff 1 — Cookie capture in root middleware

**File:** `middleware.ts`  
**Why:** Earliest capture; persists `ref` across email-confirm and OAuth redirects.

```typescript
// middleware.ts — add import at top
import { applyReferralCaptureToResponse } from "@/partner-center/lib/referral-capture/middleware";

// inside middleware(), replace final `return response` with:
let finalResponse = response;
const ref = request.nextUrl.searchParams.get("ref");
if (ref) {
  finalResponse = await applyReferralCaptureToResponse(request, finalResponse, ref);
}
return finalResponse;
```

Run ref capture once at the bottom (after the partner-center `/login` redirect block, before return). If the partner-center branch returns early, apply the same pattern there or refactor so capture runs on every exit path.

---

## Handoff 2 — Password signup (immediate session)

**File:** `app/auth/signup/route.ts`  
**When:** Inside `if (data.user)` block, after `ensureBaseAccount` succeeds (~line 54).

```typescript
// app/auth/signup/route.ts — add imports at top
import { cookies } from "next/headers";
import {
  resolveReferralAttributionFromCookie,
  createPartnerReferralOnSignup,
} from "@/partner-center/lib/referral-capture";

// after ensureBaseAccount(...) inside if (data.user):
try {
  const attribution = resolveReferralAttributionFromCookie(await cookies());
  if (attribution) {
    await createPartnerReferralOnSignup({
      userId: data.user.id,
      email: body.email,
      fullName: body.fullName,
      referralCode: attribution.code,
      capturedAt: attribution.capturedAt,
    });
  }
} catch {
  // Referral attribution must never block signup.
}
```

Email-confirm-pending signups (`!data.session`) skip this block. They would attribute on callback (Handoff 3) only if the `pa_partner_ref` cookie from the original `/signup?ref=…` visit is still present — fragile for different device/browser confirms.

---

## Handoff 3 — Email confirm + OAuth callback

**File:** `app/auth/callback/route.ts`  
**When:** Inside `if (user)` block, after `ensureBaseAccount` (~line 60).

```typescript
// app/auth/callback/route.ts — add imports at top
import { cookies } from "next/headers";
import {
  resolveReferralAttributionFromCookie,
  createPartnerReferralOnSignup,
} from "@/partner-center/lib/referral-capture";

// after ensureBaseAccount(...) inside if (user):
try {
  const attribution = resolveReferralAttributionFromCookie(await cookies());
  if (attribution) {
    // TODO(post-demo): SRS 17.5.10 — skip if user.created_at indicates returning user (OAuth re-login)
    await createPartnerReferralOnSignup({
      userId: user.id,
      email: user.email ?? "",
      fullName: user.user_metadata?.full_name as string | undefined,
      referralCode: attribution.code,
      capturedAt: attribution.capturedAt,
    });
  }
} catch {
  // Referral attribution must never block auth callback.
}
```

---

## Checklist

| # | File | Blocks |
|---|---|---|
| 1 | `middleware.ts` | Cookie never set → signup routes have nothing to read |
| 2 | `app/auth/signup/route.ts` | Immediate-session password signup never creates referral |
| 3 | `app/auth/callback/route.ts` | Email confirm + OAuth never creates referral |

---

## Manual verification (module only)

```typescript
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import {
  validateReferralCode,
  captureReferralFromParam,
  createPartnerReferralOnSignup,
} from "@/partner-center/lib/referral-capture";

const admin = createAdminClient();

await validateReferralCode("your-partner-code", admin);
await captureReferralFromParam("your-partner-code", admin);
await createPartnerReferralOnSignup({
  userId: "...",
  email: "test@example.com",
  fullName: "Test User",
  referralCode: "your-partner-code",
}, admin);
```

Re-run the last call to confirm idempotency (`created: false`).

---

## Known post-demo gaps

- **OAuth re-login:** Returning users clicking a referral link and signing in with Google can get a referral row. See SRS 17.5.10. Fix: gate on `isNewSignup` (see TODO in Handoff 3 and `create-referral-on-signup.ts`).
- **Email confirm on different device:** Cookie not present on callback — no attribution. Fix: pass `ref` through confirm redirect or persist pending attribution server-side at signup time.
