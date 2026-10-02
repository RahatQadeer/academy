import Link from "next/link";
import {
  CredentialScene,
  PipelineScene,
  PlanScene,
  PortalScene,
} from "@/base/landing/NotionScenes";
import { IconArrow, IconCheck } from "@/base/landing/brand/Icons";
import { cn } from "@/base/lib/cn";
import {
  MODULE_PAGES,
  moduleHref,
  type ModuleSlug,
} from "@/base/landing/modules";

const SCENES: Record<
  ModuleSlug,
  (props: { className?: string }) => React.JSX.Element
> = {
  whitby: PlanScene,
  portal: PortalScene,
  academy: CredentialScene,
  partner: PipelineScene,
};

type PlatformCapabilitySectionProps = {
  slug: ModuleSlug;
  reverse?: boolean;
};

/** One capability on the platform overview — copy + live scene, not a landing duplicate. */
export function PlatformCapabilitySection({
  slug,
  reverse = false,
}: PlatformCapabilitySectionProps) {
  const page = MODULE_PAGES[slug];
  const Scene = SCENES[slug];

  return (
    <div className={cn("platform-capability", reverse && "platform-capability--reverse")}>
      <div className="platform-capability__copy">
        <p className="notion-label">{page.title}</p>
        <h2 className="notion-h2 mb-3">{page.headline}</h2>
        <p className="notion-lede mb-6">{page.lede}</p>

        <ul className="platform-capability__list">
          {page.capabilities.map((cap) => (
            <li key={cap.title} className="platform-capability__item">
              <span className="platform-capability__check">
                <IconCheck size={11} strokeWidth={3} />
              </span>
              <div>
                <div className="text-[14px] font-semibold text-pa-ink">{cap.title}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-pa-muted">{cap.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <Link
          href={moduleHref(slug)}
          className="platform-capability__link notion-btn notion-btn--secondary mt-8 inline-flex"
        >
          Full {page.title} overview
          <IconArrow size={15} />
        </Link>
      </div>

      <div className="platform-capability__scene">
        <Scene />
      </div>
    </div>
  );
}
