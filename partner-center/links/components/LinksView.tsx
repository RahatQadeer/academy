"use client";

import { useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";
import { Button } from "@/base/components/Button";
import { cn } from "@/base/lib/cn";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { usePartnerUi } from "@/partner-center/components/PartnerUiProvider";
import { GetReferralLinkButton } from "@/partner-center/referrals/components/GetReferralLinkButton";
import { pcType } from "@/partner-center/lib/typography";
import type { LinksPageData } from "@/partner-center/links/types";

const HOW_IT_WORKS = [
  {
    n: "1",
    title: "Share your link",
    body: "Copy it into email, chat, or social — one link covers Academy and Whitby.",
  },
  {
    n: "2",
    title: "They sign up",
    body: "After signup they land on the product switcher and can open either product.",
  },
  {
    n: "3",
    title: "You get credit",
    body: "Attributed referrals show up under Referrals when they convert.",
  },
] as const;

export function LinksView({ data }: { data: LinksPageData }) {
  const referralUrl = data.sharedReferralUrl;
  const whose = data.companyName ? ` for ${data.companyName}` : "";

  return (
    <div className="flex min-h-full flex-col px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome
        title="Referral Link"
        subtitle={`Your shareable link${whose}. One link for Academy and Whitby.`}
      />

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center py-6 sm:py-10">
        {referralUrl ? (
          <ReferralLinkCard url={referralUrl} companyName={data.companyName} />
        ) : (
          <EmptyLinkState />
        )}
      </div>
    </div>
  );
}

function ReferralLinkCard({
  url,
  companyName,
}: {
  url: string;
  companyName: string | null;
}) {
  return (
    <div className="pa-partner-card overflow-hidden">
      <div
        className="border-b px-5 py-6 sm:px-7 sm:py-7"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(165deg, var(--accent-tint) 0%, var(--accent-tint-soft) 42%, #ffffff 100%)",
        }}
      >
        <div className="flex items-start gap-3.5">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px]"
            style={{
              background: "var(--surface)",
              color: "var(--accent)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, white)",
            }}
            aria-hidden
          >
            <Link2 size={20} strokeWidth={2.1} />
          </span>
          <div className="min-w-0 pt-0.5">
            <p
              className={cn(pcType.metaMedium, "uppercase tracking-[0.06em]")}
              style={{ color: "var(--accent)" }}
            >
              Ready to share
            </p>
            <h2
              className={cn(pcType.title, "mt-1 m-0 tracking-[-0.25px]")}
              style={{ color: "var(--ink)" }}
            >
              Your Private Attaché referral link
            </h2>
            <p
              className={cn(pcType.subtitle, "mt-1.5 m-0 max-w-[46ch]")}
              style={{ color: "var(--text-secondary)" }}
            >
              {companyName
                ? `Share this as ${companyName}. People who sign up through it are attributed to you.`
                : "People who sign up through this link are attributed to you."}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-7 sm:py-6">
        <p
          className={cn(pcType.metaMedium, "mb-2 uppercase tracking-[0.06em]")}
          style={{ color: "var(--text-tertiary)" }}
        >
          Shared referral link
        </p>
        <div
          className="break-all rounded-[10px] px-3.5 py-3 font-mono text-[12.5px] leading-[1.55] sm:text-[13px]"
          style={{
            background: "var(--surface-soft)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
          tabIndex={0}
          onFocus={(event) => {
            const selection = window.getSelection();
            if (!selection) return;
            const range = document.createRange();
            range.selectNodeContents(event.currentTarget);
            selection.removeAllRanges();
            selection.addRange(range);
          }}
        >
          {url}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <CopyLinkButton url={url} />
          <ShareLinkButton url={url} />
        </div>

        <div
          className="mt-6 border-t pt-5"
          style={{ borderColor: "var(--border)" }}
        >
          <p
            className={cn(pcType.metaMedium, "mb-3.5 uppercase tracking-[0.06em]")}
            style={{ color: "var(--text-tertiary)" }}
          >
            How it works
          </p>
          <ol className="m-0 grid list-none gap-4 p-0 sm:grid-cols-3 sm:gap-3">
            {HOW_IT_WORKS.map((step) => (
              <li key={step.n} className="min-w-0">
                <span
                  className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
                  style={{
                    background: "var(--accent-tint)",
                    color: "var(--accent)",
                  }}
                >
                  {step.n}
                </span>
                <p
                  className={cn(pcType.bodyStrong, "m-0")}
                  style={{ color: "var(--ink)" }}
                >
                  {step.title}
                </p>
                <p
                  className={cn(pcType.label, "mt-0.5 m-0 leading-relaxed font-normal")}
                  style={{ color: "var(--text-secondary)" }}
                >
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function EmptyLinkState() {
  return (
    <div className="pa-partner-card px-6 py-12 text-center sm:px-10">
      <span
        className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[11px]"
        style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        aria-hidden
      >
        <Link2 size={22} strokeWidth={2.25} />
      </span>
      <h2
        className={cn(pcType.title, "m-0 mb-2")}
        style={{ color: "var(--ink)" }}
      >
        Create your referral link
      </h2>
      <p
        className={cn(pcType.subtitle, "mx-auto mb-6 max-w-[36ch]")}
        style={{ color: "var(--text-secondary)" }}
      >
        Generate your shareable link for Academy and Whitby. You can copy it
        anytime from this page.
      </p>
      <div className="flex justify-center">
        <GetReferralLinkButton label="Generate referral link" />
      </div>
    </div>
  );
}

function CopyLinkButton({ url }: { url: string }) {
  const { showToast } = usePartnerUi();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        showToast("Link copied to clipboard");
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <Button type="button" variant="primary" onClick={() => void onCopy()}>
      <span className="inline-flex items-center gap-2">
        {copied ? (
          <Check size={15} strokeWidth={2.4} aria-hidden />
        ) : (
          <Copy size={15} strokeWidth={2.2} aria-hidden />
        )}
        {copied ? "Copied" : "Copy link"}
      </span>
    </Button>
  );
}

function ShareLinkButton({ url }: { url: string }) {
  const { showToast } = usePartnerUi();

  async function onShare() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Private Attaché referral",
          text: "Join Private Attaché with my referral link:",
          url,
        });
        return;
      } catch {
        /* user cancelled or share failed — fall through to copy */
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast("Link copied — paste it anywhere to share");
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={() => void onShare()}>
      <span className="inline-flex items-center gap-2">
        <Share2 size={15} strokeWidth={2.2} aria-hidden />
        Share
      </span>
    </Button>
  );
}
