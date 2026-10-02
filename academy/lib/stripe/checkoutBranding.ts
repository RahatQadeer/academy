import "server-only";

import type Stripe from "stripe";

/** Stripe Checkout branding for Private Attaché Academy (hosted Checkout only). */
export const ACADEMY_STRIPE_BRANDING = {
  display_name: "Private Attaché Academy",
  background_color: "#f1f1ef",
  button_color: "#6b4fa8",
  font_family: "inter" as const,
  border_style: "rounded" as const,
};

export function academyStripeCheckoutPresentation(input: {
  programName: string;
  customerEmail?: string | null;
}): Pick<
  Stripe.Checkout.SessionCreateParams,
  "branding_settings" | "custom_text" | "customer_email" | "billing_address_collection"
> {
  const submitMessage = `Enroll in ${input.programName}`.slice(0, 120);

  return {
    branding_settings: { ...ACADEMY_STRIPE_BRANDING },
    billing_address_collection: "auto",
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    custom_text: {
      submit: { message: submitMessage },
      after_submit: {
        message: "You will return to Academy to open your course right away.",
      },
    },
  };
}

export function academyStripeProductData(input: {
  programName: string;
  programId: string;
  programDescription?: string | null;
}): Stripe.Checkout.SessionCreateParams.LineItem.PriceData.ProductData {
  const description = (input.programDescription ?? "").trim().slice(0, 500);
  return {
    name: input.programName.trim() || "Academy program",
    ...(description ? { description } : {}),
    metadata: {
      academy_program_id: input.programId,
    },
  };
}
