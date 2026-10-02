export function checkoutSessionHref(sessionId: string) {
  return `/academy/checkout/${sessionId}`;
}

export function programCheckoutHref(programId: string) {
  return `/academy/explore/${programId}/checkout`;
}
