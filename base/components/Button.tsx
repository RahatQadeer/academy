import { cn } from "@/base/lib/cn";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "dark" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  href?: string;
  /**
   * Drop the default size so `className` can set its own.
   *
   * `cn` only joins strings — it does not resolve Tailwind conflicts — and the
   * winner between two competing utilities is decided by the order Tailwind
   * emits them, not by the order they are written. `.px-[18px]` is emitted
   * after `.px-4` and `.text-[14.5px]` after `.text-[13.5px]`, so a caller
   * asking for a 16px, 13.5px button silently got an 18px, 14.5px one. This
   * removes the competitor rather than trying to out-rank it.
   */
  unsized?: boolean;
};

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover hover:text-white",
  dark: "bg-ink text-white hover:opacity-90 hover:text-white",
  secondary:
    "bg-transparent text-ink border border-line-strong hover:bg-surface-soft hover:text-ink",
  ghost: "bg-transparent text-ink hover:bg-surface-soft hover:text-ink",
};

export function Button({
  variant = "primary",
  fullWidth,
  unsized,
  className,
  type = "button",
  href,
  style,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-control font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors no-underline",
    !unsized && "text-[14.5px] px-[18px] py-[10px]",
    variants[variant],
    fullWidth && "w-full",
    className,
  );

  if (href) {
    /*
     * `style` goes to the link too.
     *
     * It used to be swallowed here: a caller passing `variant="primary"` with
     * a style of its own got the variant's own background and no word about
     * it, because only `className` was forwarded and the style object was
     * left behind with the props it was destructured out of. Silent, and the
     * kind of silent that looks like a CSS specificity problem for an hour.
     */
    return (
      <Link href={href} className={classes} style={style}>
        {props.children}
      </Link>
    );
  }

  return <button type={type} className={classes} style={style} {...props} />;
}
