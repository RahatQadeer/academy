const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCheckoutAmount(amount: number, currency = "usd") {
  if (currency.toLowerCase() === "usd") {
    return usd.format(amount);
  }
  return `${amount} ${currency.toUpperCase()}`;
}

export function isStripeCheckoutConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function isStripeMockCheckoutEnabled() {
  return !isStripeCheckoutConfigured();
}
