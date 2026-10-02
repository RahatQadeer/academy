import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Callout } from "@/base/components/Callout";
import { AcademyEntry } from "@/academy/AcademyEntry";
import { ExploreSkeleton } from "@/academy/explore/components/ExploreSkeleton";
import { CheckoutView } from "./components/CheckoutView";
import { loadCheckoutSession } from "./services/loadCheckoutSession";
import { createCheckoutSession } from "./services/createCheckoutSession";
import { syncStripeCheckoutPayment } from "./services/stripeCheckout";
import { checkoutSessionHref } from "./utils/checkoutHref";
import { isStripeCheckoutConfigured } from "./utils/payment";
import { lessonPlayerHref } from "@/academy/lesson-player/utils/curriculum";

async function CheckoutBody({
  userId,
  checkoutId,
  searchParams,
}: {
  userId: string;
  checkoutId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const success = searchParams.success === "1";
  const canceled = searchParams.canceled === "1";

  if (success && isStripeCheckoutConfigured()) {
    const synced = await syncStripeCheckoutPayment(checkoutId, userId);
    if (synced.status === "paid") {
      redirect(lessonPlayerHref(synced.enrollment.program_id));
    }
  }

  const result = await loadCheckoutSession(userId, checkoutId);

  if (!result.ok) {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Checkout unavailable">
          This checkout could not be loaded. Return to Explore and try again.
        </Callout>
      </div>
    );
  }

  return <CheckoutView data={result.data} canceled={canceled} />;
}

export function CheckoutPage({
  userId,
  preview,
  checkoutId,
  searchParams = {},
}: {
  userId: string;
  preview: boolean;
  checkoutId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <AcademyEntry userId={userId} preview={preview}>
      <Suspense fallback={<ExploreSkeleton />}>
        <CheckoutBody userId={userId} checkoutId={checkoutId} searchParams={searchParams} />
      </Suspense>
    </AcademyEntry>
  );
}

async function ProgramCheckoutRedirectBody({
  userId,
  programId,
}: {
  userId: string;
  programId: string;
}) {
  const result = await createCheckoutSession(programId);

  if (result.status === "already_enrolled") {
    redirect(lessonPlayerHref(programId));
  }

  if (result.status === "created" || result.status === "existing") {
    redirect(checkoutSessionHref(result.checkout.id));
  }

  return (
    <div className="px-6 py-10 lg:px-14">
      <Callout tone="warning" title="Checkout unavailable">
        This program cannot be purchased right now. Check prerequisites or try again later.
      </Callout>
    </div>
  );
}

export function ProgramCheckoutPage({
  userId,
  preview,
  programId,
}: {
  userId: string;
  preview: boolean;
  programId: string;
}) {
  return (
    <AcademyEntry userId={userId} preview={preview}>
      <Suspense fallback={<ExploreSkeleton />}>
        <ProgramCheckoutRedirectBody userId={userId} programId={programId} />
      </Suspense>
    </AcademyEntry>
  );
}
