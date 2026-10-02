"use client";

import Link from "next/link";
import { IconArrow, MODULE_ICONS } from "@/base/landing/brand/Icons";
import {
  CredentialScene,
  PipelineScene,
  PlanScene,
  PortalScene,
} from "@/base/landing/NotionScenes";
import type { ModuleKey } from "@/base/landing/content";
import { cn } from "@/base/lib/cn";

type Card = {
  key: ModuleKey;
  name: string;
  title: string;
  body: string;
  Scene: (props: { className?: string }) => React.JSX.Element;
  feature?: boolean;
};

const CARDS: Card[] = [
  {
    key: "whitby",
    name: "Whitby",
    title: "Describe it once. Whitby drafts the plan and runs it.",
    body: "Routine steps run on their own. Anything sensitive — a budget, a filing, a signature — stops and waits for a named person to approve.",
    Scene: PlanScene,
    feature: true,
  },
  {
    key: "portal",
    name: "Client Portal",
    title: "What the principal sees, and nothing else.",
    body: "Live status, shared documents and next steps. Internal workplans and provider research never surface.",
    Scene: PortalScene,
  },
  {
    key: "academy",
    name: "Academy",
    title: "Credentialed before they touch an engagement.",
    body: "Learning, applied work and a proctored assessment lead to the Certified Private Attaché credential.",
    Scene: CredentialScene,
  },
  {
    key: "partner",
    name: "Partner Center",
    title: "Refer once. Earn on every conversion.",
    body: "Track a referral from submission to payout, with a protection window while it's worked.",
    Scene: PipelineScene,
  },
];

export function NotionModuleGrid({
  highlight,
  hrefForKey,
}: {
  highlight?: ModuleKey | null;
  /** Defaults to module detail routes. Use on /platform for in-page anchors. */
  hrefForKey?: (key: ModuleKey) => string;
}) {
  const resolveHref = hrefForKey ?? ((key: ModuleKey) => `/modules/${key}`);

  return (
    <div className="notion-bento">
      {CARDS.map(({ key, name, title, body, Scene, feature }, index) => {
        const Icon = MODULE_ICONS[key];
        return (
          <Link
            key={key}
            href={resolveHref(key)}
            id={`module-card-${key}`}
            data-module={key}
            className={cn(
              "notion-bento-card",
              feature && "notion-bento-card--feature",
              highlight === key && "notion-bento-card--highlight",
            )}
            style={{ "--i": index } as React.CSSProperties}
          >
            {feature ? (
              <>
                <div className="notion-bento-copy">
                  <span className="notion-bento-name">
                    <Icon size={15} />
                    {name}
                  </span>
                  <h3 className="notion-bento-title">{title}</h3>
                  <p className="notion-bento-body">{body}</p>
                  <span className="notion-bento-link">
                    Explore {name}
                    <IconArrow size={14} />
                  </span>
                </div>
                <div className="notion-bento-visual">
                  <Scene />
                </div>
              </>
            ) : (
              <>
                <div className="notion-bento-visual">
                  <Scene />
                </div>
                <div className="notion-bento-copy">
                  <span className="notion-bento-name">
                    <Icon size={15} />
                    {name}
                  </span>
                  <h3 className="notion-bento-title">{title}</h3>
                  <p className="notion-bento-body">{body}</p>
                  <span className="notion-bento-link">
                    Explore {name}
                    <IconArrow size={14} />
                  </span>
                </div>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}
