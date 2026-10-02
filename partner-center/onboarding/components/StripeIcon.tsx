/** Square Stripe mark — SVG so it stays sharp and never squashes. */
export function StripeIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="block shrink-0"
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      <rect width="32" height="32" rx="8" fill="#635BFF" />
      <text
        x="16"
        y="17"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize="18"
        fontWeight="700"
        fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
      >
        S
      </text>
    </svg>
  );
}
