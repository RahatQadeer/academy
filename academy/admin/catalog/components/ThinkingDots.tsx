export function ThinkingDots({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-1 px-0.5 py-1" aria-hidden>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="whitby-thinking-dot inline-block h-[6px] w-[6px] rounded-full"
            style={{
              background: "var(--accent, #2383e2)",
              animationDelay: `${index * 0.14}s`,
            }}
          />
        ))}
      </div>
      <span className="text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}
