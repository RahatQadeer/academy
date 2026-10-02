import type { AcademyProgramType } from "@/academy/lib/domain";

type Scene = {
  sky: string;
  mid: string;
  ground: string;
  glow: string;
  ink: string;
  motif: "arches" | "books" | "orbit" | "quill" | "lanes" | "studio";
};

function sceneFor(type: AcademyProgramType): Scene {
  if (type === "certification_program") {
    return {
      sky: "#1a1430",
      mid: "#4a3a7a",
      ground: "#d8ccec",
      glow: "rgba(232, 214, 255, 0.35)",
      ink: "rgba(255,255,255,0.78)",
      motif: "arches",
    };
  }
  if (type === "endorsement_program") {
    return {
      sky: "#102433",
      mid: "#2f5f7a",
      ground: "#d5e7f1",
      glow: "rgba(190, 220, 240, 0.35)",
      ink: "rgba(255,255,255,0.75)",
      motif: "orbit",
    };
  }
  if (type === "short_course") {
    return {
      sky: "#143528",
      mid: "#2f7a55",
      ground: "#d9eedc",
      glow: "rgba(200, 236, 210, 0.35)",
      ink: "rgba(255,255,255,0.78)",
      motif: "books",
    };
  }
  return {
    sky: "#2a2824",
    mid: "#5a574e",
    ground: "#ebe8e0",
    glow: "rgba(240, 236, 224, 0.32)",
    ink: "rgba(255,255,255,0.75)",
    motif: "studio",
  };
}

/**
 * Default Academy atmosphere cover when no photo is uploaded.
 * Scenic study-hall feel — not a flat box placeholder.
 */
export function ProgramCoverArt({
  type,
  className,
}: {
  type: AcademyProgramType;
  className?: string;
}) {
  const scene = sceneFor(type);

  return (
    <div
      className={`relative aspect-[16/10] w-full overflow-hidden ${className ?? ""}`}
      style={{
        background: `linear-gradient(165deg, ${scene.sky} 0%, ${scene.mid} 46%, ${scene.ground} 100%)`,
      }}
      aria-hidden
    >
      {/* Atmospheric haze */}
      <span
        className="absolute inset-0 transition-opacity duration-500 group-hover:opacity-90"
        style={{
          background: `radial-gradient(90% 70% at 70% 20%, ${scene.glow}, transparent 60%), radial-gradient(70% 60% at 15% 85%, ${scene.glow}, transparent 55%)`,
        }}
      />

      {/* Soft film grain */}
      <span
        className="absolute inset-0 opacity-[0.14] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Light shafts */}
      <span
        className="absolute -top-8 left-[28%] h-[140%] w-[38%] -rotate-[18deg] opacity-25 transition-transform duration-700 group-hover:translate-x-2"
        style={{
          background: `linear-gradient(90deg, transparent, ${scene.glow}, transparent)`,
        }}
      />
      <span
        className="absolute -top-10 left-[48%] h-[140%] w-[22%] -rotate-[18deg] opacity-15"
        style={{
          background: `linear-gradient(90deg, transparent, ${scene.glow}, transparent)`,
        }}
      />

      {/* Horizon wash */}
      <span
        className="absolute inset-x-0 bottom-0 h-[42%]"
        style={{
          background: `linear-gradient(to top, ${scene.ground} 0%, transparent 100%)`,
          opacity: 0.55,
        }}
      />

      <Motif kind={scene.motif} ink={scene.ink} />

      {/* Bottom vignette for depth */}
      <span
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(15,15,15,0.22) 0%, transparent 38%), linear-gradient(to right, rgba(15,15,15,0.12) 0%, transparent 28%)",
        }}
      />
    </div>
  );
}

function Motif({ kind, ink }: { kind: Scene["motif"]; ink: string }) {
  if (kind === "arches") {
    return (
      <svg
        className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        viewBox="0 0 640 400"
        fill="none"
        aria-hidden
      >
        <path d="M40 360V180c0-70 48-120 110-120s110 50 110 120v180" stroke={ink} strokeWidth="1.4" opacity="0.55" />
        <path d="M220 360V160c0-78 54-132 125-132s125 54 125 132v200" stroke={ink} strokeWidth="1.5" opacity="0.7" />
        <path d="M380 360V190c0-64 44-110 100-110s100 46 100 110v170" stroke={ink} strokeWidth="1.3" opacity="0.45" />
        <path d="M20 318h600" stroke={ink} strokeWidth="1" opacity="0.28" />
        <circle cx="520" cy="78" r="28" fill={ink} opacity="0.12" />
        <circle cx="520" cy="78" r="16" stroke={ink} strokeWidth="1.2" opacity="0.45" />
      </svg>
    );
  }

  if (kind === "books") {
    return (
      <svg
        className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        viewBox="0 0 640 400"
        fill="none"
        aria-hidden
      >
        <path
          d="M170 250c40-28 90-28 130 0v70c-40-24-90-24-130 0v-70z"
          stroke={ink}
          strokeWidth="1.5"
          opacity="0.55"
        />
        <path
          d="M300 250c40-28 90-28 130 0v70c-40-24-90-24-130 0v-70z"
          stroke={ink}
          strokeWidth="1.5"
          opacity="0.7"
        />
        <path d="M300 250v70" stroke={ink} strokeWidth="1.3" opacity="0.55" />
        <path d="M120 330h400" stroke={ink} strokeWidth="1" opacity="0.25" />
        <path d="M210 120c30-18 70-18 100 0" stroke={ink} strokeWidth="1.2" opacity="0.35" />
        <path d="M230 140c24-12 56-12 80 0" stroke={ink} strokeWidth="1.1" opacity="0.28" />
        <circle cx="480" cy="96" r="36" fill={ink} opacity="0.1" />
      </svg>
    );
  }

  if (kind === "orbit") {
    return (
      <svg
        className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        viewBox="0 0 640 400"
        fill="none"
        aria-hidden
      >
        <ellipse cx="320" cy="200" rx="190" ry="78" stroke={ink} strokeWidth="1.2" opacity="0.35" />
        <ellipse cx="320" cy="200" rx="130" ry="52" stroke={ink} strokeWidth="1.2" opacity="0.5" />
        <ellipse cx="320" cy="200" rx="70" ry="28" stroke={ink} strokeWidth="1.3" opacity="0.65" />
        <circle cx="320" cy="200" r="10" fill={ink} opacity="0.55" />
        <circle cx="450" cy="175" r="5" fill={ink} opacity="0.7" />
        <circle cx="210" cy="220" r="4" fill={ink} opacity="0.55" />
        <circle cx="500" cy="90" r="26" fill={ink} opacity="0.12" />
      </svg>
    );
  }

  if (kind === "quill") {
    return (
      <svg
        className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        viewBox="0 0 640 400"
        fill="none"
        aria-hidden
      >
        <path
          d="M150 290c70-10 130-55 165-115 8-14 22-18 34-10 12 8 14 24 4 36-40 55-105 100-178 118"
          stroke={ink}
          strokeWidth="1.5"
          opacity="0.65"
        />
        <path d="M349 165l70-95" stroke={ink} strokeWidth="1.4" opacity="0.55" />
        <path d="M360 150c18-8 38-6 52 8" stroke={ink} strokeWidth="1.1" opacity="0.4" />
        <path d="M120 320c90 8 180 8 280 0" stroke={ink} strokeWidth="1" opacity="0.25" />
        <circle cx="500" cy="100" r="34" fill={ink} opacity="0.1" />
      </svg>
    );
  }

  if (kind === "lanes") {
    return (
      <svg
        className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        viewBox="0 0 640 400"
        fill="none"
        aria-hidden
      >
        <path d="M80 340L250 90h40L180 340H80z" stroke={ink} strokeWidth="1.2" opacity="0.35" />
        <path d="M200 340L320 70h44L290 340H200z" stroke={ink} strokeWidth="1.3" opacity="0.55" />
        <path d="M320 340L400 95h40L430 340H320z" stroke={ink} strokeWidth="1.2" opacity="0.4" />
        <path d="M60 318h520" stroke={ink} strokeWidth="1" opacity="0.22" />
        <circle cx="520" cy="86" r="30" fill={ink} opacity="0.12" />
      </svg>
    );
  }

  return (
    <svg
      className="absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
      viewBox="0 0 640 400"
      fill="none"
      aria-hidden
    >
      <rect x="160" y="120" width="220" height="160" rx="10" stroke={ink} strokeWidth="1.3" opacity="0.45" />
      <path d="M180 155h180M180 185h140M180 215h160M180 245h100" stroke={ink} strokeWidth="1.1" opacity="0.35" />
      <circle cx="470" cy="150" r="54" stroke={ink} strokeWidth="1.2" opacity="0.35" />
      <circle cx="470" cy="150" r="28" fill={ink} opacity="0.12" />
      <path d="M100 320h440" stroke={ink} strokeWidth="1" opacity="0.22" />
    </svg>
  );
}

export function ProgramCover({
  src,
  alt,
  className,
  aspect = "video",
  framed = true,
}: {
  src: string;
  alt: string;
  className?: string;
  aspect?: "video" | "square";
  /** When false, no border — used for immersive heroes. */
  framed?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden ${framed ? "rounded-[12px] border" : "rounded-[16px]"} ${className ?? ""}`}
      style={{
        borderColor: framed ? "var(--border)" : undefined,
        background: "var(--surface-soft, #f7f7f5)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`w-full object-cover ${aspect === "square" ? "aspect-square" : "aspect-video"}`}
      />
    </div>
  );
}
