/**
 * Local section photography (Unsplash License — free for commercial use).
 * Files live in public/images/sections/.
 */
/** Bust caches when replacing the file (path change + direct serve in hero). */
export const HERO_BACKGROUND = {
  src: "/images/sections/hero-platform.jpg",
  alt: "Glass towers and skyline — enterprise coordination context",
} as const;

export const SECTION_IMAGES = {
  coordination: {
    src: "/images/sections/coordination.jpg",
    alt: "Professional reviewing plans at a modern desk",
    credit: "Unsplash",
  },
  portal: {
    src: "/images/sections/portal.jpg",
    alt: "Private residence interior with natural light",
    credit: "Unsplash",
  },
  yacht: {
    src: "/images/sections/yacht.jpg",
    alt: "Aerial view of a superyacht on deep teal water",
    credit: "Ibrahim Mushan / Unsplash",
  },
  academy: {
    src: "/images/sections/academy.jpg",
    alt: "Reference books and study materials on a shelf",
    credit: "Unsplash",
  },
  partner: {
    src: "/images/sections/partner.jpg",
    alt: "Business documents and laptop on a conference table",
    credit: "Unsplash",
  },
  mobility: {
    src: "/images/sections/mobility.jpg",
    alt: "Traveler with luggage in a bright terminal",
    credit: "Unsplash",
  },
  principles: {
    src: "/images/sections/principles.jpg",
    alt: "City skyline at dusk, viewed from an office window",
    credit: "Unsplash",
  },
} as const;

export type SectionImageKey = keyof typeof SECTION_IMAGES;
