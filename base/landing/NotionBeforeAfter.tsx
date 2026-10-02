"use client";

import { useState } from "react";
import { IconCheck, IconClose } from "@/base/landing/brand/Icons";
import { NotionHeading, NotionSection } from "@/base/landing/NotionSection";
import { SectionPhoto } from "@/base/landing/SectionPhoto";
import { cn } from "@/base/lib/cn";
import {
  COMPARE_AFTER,
  COMPARE_BEFORE,
  COMPARE_DETAILS,
} from "@/base/landing/content";

export function NotionBeforeAfter() {
  const [compareSide, setCompareSide] = useState<"before" | "after">("after");
  const compare = COMPARE_DETAILS[compareSide];

  return (
    <NotionSection reveal={false}>
      <NotionHeading
        label="Before & after"
        title="What changes when Whitby runs the coordination"
        lede="Same relocation request, two ways of handling it. Click either card."
      />
      <div className="notion-module-shell">
        <SectionPhoto
          image="mobility"
          className="mb-6 aspect-[21/9] w-full max-h-[220px]"
          sizes="100vw"
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setCompareSide("before")}
            className={cn(
              "notion-interactive-card block rounded p-[22px] text-left",
              compareSide === "before"
                ? "border border-[#d8d4c8] bg-pa-bg"
                : "border border-[#ececea] bg-[#fbfbfa]",
            )}
          >
            <div className="mb-2.5 text-[11px] font-bold tracking-[0.05em] text-pa-ink/40 uppercase">
              Without Whitby
            </div>
            <div className="mb-3.5 text-[15px] leading-snug font-bold">
              A team member coordinates by email and spreadsheet
            </div>
            <div className="flex flex-col gap-2.5">
              {COMPARE_BEFORE.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 text-[12.5px] leading-normal text-pa-muted"
                >
                  <IconClose size={14} className="mt-0.5 shrink-0 text-pa-ink/30" />
                  <span className="min-w-0">{item}</span>
                </div>
              ))}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setCompareSide("after")}
            className={cn(
              "notion-interactive-card block rounded p-[22px] text-left",
              compareSide === "after"
                ? "border border-pa-blue bg-pa-soft"
                : "border border-[#ececea] bg-[#fbfbfa]",
            )}
          >
            <div className="mb-2.5 text-[11px] font-bold tracking-[0.05em] text-pa-blue-dark uppercase">
              With Whitby
            </div>
            <div className="mb-3.5 text-[15px] leading-snug font-bold">
              Whitby drafts the plan; a person approves the sensitive parts
            </div>
            <div className="flex flex-col gap-2.5">
              {COMPARE_AFTER.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 text-[12.5px] leading-normal text-pa-ink/75"
                >
                  <IconCheck size={14} className="mt-0.5 shrink-0 text-pa-blue" />
                  <span className="min-w-0">{item}</span>
                </div>
              ))}
            </div>
          </button>
        </div>
        <div className="mt-5 rounded border-l-2 border-pa-blue bg-pa-panel px-4 py-3">
          <div className="mb-1 text-xs font-semibold text-pa-muted">{compare.label}</div>
          <div className="text-[13.5px] leading-relaxed text-pa-ink/80">{compare.text}</div>
        </div>
      </div>
    </NotionSection>
  );
}
