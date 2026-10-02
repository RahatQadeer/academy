"use client";

import { cn } from "@/base/lib/cn";
import {
  isPaidAccess,
  pricingAccessOptions,
  toPricingAccess,
  type PricingAccess,
} from "@/academy/lib/courseMetadata";

/**
 * Binary Free / Paid control for program settings (Pricing).
 * Paid maps to access `purchased`; Free disables the price field.
 * Program Type (Course / Short Course / …) is a separate Settings field.
 */
export function PricingAccessField({
  access,
  price,
  disabled,
  onAccessChange,
  onPriceChange,
  className,
  brief = false,
}: {
  access: string;
  price: string;
  disabled?: boolean;
  onAccessChange: (access: PricingAccess) => void;
  onPriceChange: (price: string) => void;
  className?: string;
  /** Hide helper copy — for compact create flows. */
  brief?: boolean;
}) {
  const pricing = toPricingAccess(access);
  const paid = isPaidAccess(access);
  const options = pricingAccessOptions();

  return (
    <div className={cn(brief ? "space-y-3" : "space-y-4", className)}>
      <div>
        {!brief ? (
          <p
            className="mb-1.5 text-[12.5px] font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            Pricing
          </p>
        ) : null}
        <div
          className={cn(
            "inline-flex w-full rounded-[8px] p-1",
            !brief && "max-w-[320px]",
          )}
          style={{
            background: "var(--surface-soft)",
            border: "1px solid var(--border)",
          }}
          role="group"
          aria-label="Pricing"
        >
          {options.map((option) => {
            const selected = pricing === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => {
                  if (disabled || selected) return;
                  onAccessChange(option.value);
                }}
                className={cn(
                  "flex-1 rounded-[6px] px-3 py-2 text-[13.5px] font-medium transition-colors",
                  disabled && "cursor-not-allowed opacity-60",
                )}
                style={
                  selected
                    ? {
                        background: "var(--surface)",
                        color: "var(--ink)",
                        boxShadow: "0 1px 2px rgba(15,15,15,0.06)",
                        border: "1px solid var(--border-strong)",
                      }
                    : {
                        background: "transparent",
                        color: "var(--text-secondary)",
                        border: "1px solid transparent",
                      }
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {!brief ? (
          <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            {paid
              ? "Learners purchase this program to unlock. Set a price below."
              : "Anyone in Academy can start this program at no charge."}
          </p>
        ) : null}
      </div>

      {paid || !brief ? (
        <div>
          <label className="block">
            <span
              className="mb-1.5 block text-[12.5px] font-medium"
              style={{ color: paid ? "var(--text-tertiary)" : "var(--text-disabled)" }}
            >
              Price (USD){paid || brief ? "" : " — not used for Free"}
            </span>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-medium"
                style={{ color: paid && !disabled ? "var(--text-secondary)" : "var(--text-disabled)" }}
              >
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={paid ? price : ""}
                disabled={disabled || !paid}
                placeholder={paid ? "0.00" : "—"}
                onChange={(event) => onPriceChange(event.target.value)}
                className="w-full rounded-[8px] border py-2.5 pl-8 pr-3.5 text-[14px] outline-none transition-all focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(35,131,226,.10)] disabled:cursor-not-allowed"
                style={{
                  borderColor: "var(--border-strong)",
                  color: paid && !disabled ? "var(--ink)" : "var(--text-disabled)",
                  background: paid && !disabled ? "var(--surface)" : "var(--surface-soft)",
                }}
              />
            </div>
          </label>
          {!brief ? (
            <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              {paid
                ? "Required for Paid programs. Checkout unlocks after purchase."
                : "Price stays empty while Pricing is Free."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
