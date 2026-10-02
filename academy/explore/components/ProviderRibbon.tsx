import type { ProgramCardProvider } from "../utils/programCardMeta";
import { programCardProviderLabel } from "../utils/programCardMeta";

/**
 * Gold seal ribbon — unique bookmark mark for catalog cards.
 * Metallic gold body + embossed provider seal.
 */
export function ProviderRibbon({ provider }: { provider: ProgramCardProvider }) {
  return (
    <div
      className="pointer-events-none absolute left-3.5 top-0 z-10 flex flex-col items-center"
      aria-hidden
    >
      <div className="academy-gold-ribbon relative flex w-[42px] flex-col items-center">
        {/* Metallic ribbon body */}
        <div
          className="relative flex w-full flex-col items-center pb-4 pt-3"
          style={{
            minHeight: 86,
            background:
              "linear-gradient(180deg, #f3e4b0 0%, #d4af37 28%, #b8860b 62%, #8a6a1a 100%)",
            boxShadow:
              "2px 0 0 rgba(255,236,170,0.35) inset, -2px 0 0 rgba(90,60,10,0.22) inset, 0 8px 18px rgba(90,60,10,0.28)",
            clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 14px), 50% 100%, 0 calc(100% - 14px))",
          }}
        >
          {/* Top highlight edge */}
          <span
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{
              background: "linear-gradient(90deg, #8a6a1a, #fff3c4 45%, #8a6a1a)",
            }}
          />

          {/* Soft sheen */}
          <span
            className="academy-gold-ribbon-sheen pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.45) 48%, transparent 62%)",
              mixBlendMode: "soft-light",
            }}
          />

          {/* Embossed seal */}
          <span
            className="relative z-[1] mt-0.5 flex h-[28px] w-[28px] items-center justify-center rounded-full"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, #fff8e0 0%, #f0d78c 42%, #c9a227 100%)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.55) inset, 0 -1px 0 rgba(90,60,10,0.35) inset, 0 2px 6px rgba(90,60,10,0.25)",
              border: "1px solid rgba(139,105,20,0.55)",
            }}
          >
            <ProviderMarkGold provider={provider} />
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProviderRow({ provider }: { provider: ProgramCardProvider }) {
  const label = programCardProviderLabel(provider);

  return (
    <div className="flex items-center gap-1.5">
      <ProviderMark provider={provider} size={18} />
      <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}

function ProviderMarkGold({ provider }: { provider: ProgramCardProvider }) {
  return (
    <span
      className="text-[12px] font-bold leading-none"
      style={{
        color: "#5c4210",
        textShadow: "0 1px 0 rgba(255,248,220,0.7)",
      }}
    >
      {provider === "whitby" ? "W" : "A"}
    </span>
  );
}

function ProviderMark({ provider, size = 18 }: { provider: ProgramCardProvider; size?: number }) {
  if (provider === "whitby") {
    return (
      <span
        className="inline-flex items-center justify-center font-bold leading-none"
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          background: "var(--module-whitby-bg)",
          color: "var(--module-whitby-fg)",
          fontSize: Math.round(size * 0.58),
        }}
      >
        W
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center font-bold leading-none"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: "var(--module-academy-bg)",
        color: "var(--module-academy-fg)",
        fontSize: Math.round(size * 0.52),
      }}
    >
      A
    </span>
  );
}
