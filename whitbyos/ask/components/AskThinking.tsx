import { Logo } from "@/base/components/Logo";

/** The same three dots the plan panel and the stream composer already use. */
export function AskThinking() {
  return (
    <div className="ask-turn" aria-live="polite">
      <AskMark />
      <span className="flex h-7 items-center gap-[5px]">
        <span className="sr-only">Whitby is working on it</span>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            aria-hidden
            className="whitby-thinking-dot block h-[5px] w-[5px] rounded-full"
            style={{
              background: "var(--text-tertiary)",
              animationDelay: `${index * 0.16}s`,
            }}
          />
        ))}
      </span>
    </div>
  );
}

/** Whitby's mark, beside the first line of whatever it says. */
export function AskMark() {
  return (
    <span className="ask-mark" aria-hidden>
      <Logo size={22} />
    </span>
  );
}
