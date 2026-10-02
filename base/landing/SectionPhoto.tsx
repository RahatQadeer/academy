import Image from "next/image";
import { cn } from "@/base/lib/cn";
import {
  SECTION_IMAGES,
  type SectionImageKey,
} from "@/base/landing/images";

type SectionPhotoProps = {
  image: SectionImageKey;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /** Slightly lighter treatment for cards vs full bleed */
  variant?: "default" | "inset" | "panel";
  /** Cover a positioned parent (e.g. security band) */
  fill?: boolean;
};

export function SectionPhoto({
  image,
  className,
  priority,
  sizes = "(max-width: 1024px) 100vw, 560px",
  variant = "default",
  fill = false,
}: SectionPhotoProps) {
  const meta = SECTION_IMAGES[image];

  return (
    <figure
      className={cn(
        "section-photo overflow-hidden bg-pa-panel",
        !fill && variant === "default" && "rounded-2xl border border-pa-line",
        !fill && variant === "inset" && "rounded-xl border border-pa-line/80",
        !fill && variant === "panel" && "rounded-2xl",
        fill && "relative h-full w-full",
        className,
      )}
    >
      <Image
        src={meta.src}
        alt={meta.alt}
        {...(fill
          ? { fill: true }
          : { width: 1200, height: 800, priority })}
        sizes={sizes}
        className="section-photo__img object-cover"
      />
    </figure>
  );
}
