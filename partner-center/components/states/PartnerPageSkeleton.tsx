function Shimmer({ className }: { className: string }) {
  return (
    <div
      className={`rounded-md ${className}`}
      style={{
        background:
          "linear-gradient(90deg, #ececea 25%, #f5f5f3 37%, #ececea 63%)",
        backgroundSize: "400px 100%",
        animation: "partner-shimmer 1.6s infinite linear",
      }}
    />
  );
}

export type PartnerSkeletonVariant =
  | "home"
  | "table"
  | "cards"
  | "profile"
  | "simple";

export function PartnerPageSkeleton({
  variant = "table",
}: {
  variant?: PartnerSkeletonVariant;
}) {
  return (
  <>
    <style>{`
      @keyframes partner-shimmer {
        0% { background-position: -200px 0; }
        100% { background-position: 200px 0; }
      }
    `}</style>
    <div className="px-5 py-8 sm:px-6 lg:px-8 xl:px-12">
      <Shimmer className="mb-2.5 h-[26px] w-[200px]" />
      <Shimmer className="mb-7 h-4 w-[320px] max-w-full" />

      {variant === "simple" ? (
        <div className="max-w-[680px] rounded-2xl border border-line bg-white p-7">
          <Shimmer className="mb-2 h-4 w-[180px]" />
          <Shimmer className="h-3.5 w-[280px] max-w-full" />
        </div>
      ) : null}

      {variant === "home" || variant === "cards" ? (
        <div className="mb-7 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="rounded-2xl border border-line bg-white p-[22px]"
            >
              <Shimmer className="mb-3.5 h-3 w-20" />
              <Shimmer className="h-[26px] w-[100px]" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "profile" ? (
        <div className="mb-7 max-w-2xl rounded-2xl border border-line bg-white p-6">
          <Shimmer className="mb-4 h-4 w-32" />
          <Shimmer className="mb-2 h-3 w-full" />
          <Shimmer className="h-3 w-4/5" />
        </div>
      ) : null}

      {variant !== "simple" ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="flex gap-6 border-b border-line px-5 py-4">
            <Shimmer className="h-3.5 w-[180px]" />
            <Shimmer className="h-3.5 w-[100px]" />
            <Shimmer className="h-3.5 w-[100px]" />
          </div>
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="flex gap-6 border-b border-line px-5 py-4 last:border-b-0"
            >
              <Shimmer className="h-3.5 w-[220px]" />
              <Shimmer className="h-3.5 w-[100px]" />
              <Shimmer className="h-3.5 w-[100px]" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  </>
  );
}
