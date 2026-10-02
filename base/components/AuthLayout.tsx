import { Logo } from "@/base/components/Logo";
import { AuthAtmosphere } from "@/base/auth/AuthAtmosphere";

/**
 * The frame every signed-out screen sits in, as screens 1 through 3.3 draw it.
 *
 * One shape repeated nine times: a canvas column holding the form on a white
 * card, and a wider column in the product's own ink beside it, holding a
 * different piece of argument on every screen. The mark and the screen's own
 * name are pinned to the top left of the form column rather than sitting above
 * the heading.
 *
 * The export puts the form on the left. Sabahat asked for the ink column on
 * that side instead (2026-09-04), so the two are swapped here and nowhere
 * else: every screen inherits it from this one file.
 *
 * What changes per screen is the panel, so it is passed rather than built.
 * `AuthPanel` below is the shape all nine share.
 */
export function AuthLayout({
  scope,
  title,
  subtitle,
  panel,
  children,
  footer,
  variant = "split",
  badge,
  glyph,
}: {
  /**
   * Which screen this is. No longer drawn beside the wordmark — the heading
   * says it — but kept on the signature so the nine screens that pass it need
   * no edit, and so a future header can use it again.
   */
  scope?: string;
  title: string;
  subtitle?: string;
  panel?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** "centered" drops the panel for a single, centered card. The portal uses it. */
  variant?: "split" | "centered";
  badge?: React.ReactNode;
  /** 2.1, 3.1 and 3.3 open with a round glyph above the heading. */
  glyph?: { mark: string; tone: "accent" | "success" };
}) {
  // The three confirmation screens centre their column and set the heading
  // smaller: 24px under a 52px glyph, not 30px over a form.
  const confirmation = Boolean(glyph);
  const inner = (
    <>
      {glyph ? <AuthGlyph {...glyph} /> : null}
      {badge ? <div>{badge}</div> : null}

      <div className="flex w-full flex-col gap-2">
        <h1
          className={
            confirmation
              ? "text-[24px] font-bold leading-[1.2] tracking-[-0.3px] text-pretty"
              : "text-[28px] font-bold leading-[1.15] tracking-[-0.4px] text-pretty"
          }
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[14.5px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>

      {children}
      {footer}
    </>
  );

  const form = (
    // Below lg the dark column is gone, so the form centres in the page
    // instead of hugging the left edge of a column that is no longer there.
    //
    // The vertical padding is asymmetric on purpose. The top band is not only
    // breathing room — it is the clearance the pinned wordmark needs, since a
    // centred card on a short window would otherwise drift underneath it.
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center px-6 sm:px-10 lg:w-[560px] lg:shrink-0 lg:items-stretch lg:px-14"
      style={{
        background: "var(--canvas)",
        // Breathing room that gives way rather than forcing a scrollbar. A
        // roomy window keeps the full 96px frame; a short one tightens to 76
        // on its own, which is what stopped Sign Up — the tallest of the nine
        // — from running past the bottom of a laptop.
        paddingTop: "clamp(72px, 9.5vh, 96px)",
        paddingBottom: "clamp(38px, 5.5vh, 56px)",
      }}
    >
      {/* Pinned to the top left of the column at full width, as the export
          draws it. Narrower, it sits above the form and shares its edge. */}
      <div className="mb-8 flex w-full max-w-[420px] items-center gap-2 self-center lg:absolute lg:left-14 lg:top-10 lg:mb-0 lg:w-auto lg:max-w-none lg:self-start">
        <Logo size={22} />
        <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
          Private Attaché
        </span>
        {/* The "/ Sign In" that used to follow the wordmark is gone. The
            heading below already says which screen this is, and saying it
            twice in two type sizes read as chrome rather than as a place. */}
      </div>

      <div
        className={
          confirmation
            ? "flex w-full max-w-[400px] flex-col items-center gap-5 self-center text-center"
            : "flex w-full max-w-[440px] flex-col gap-6 self-center rounded-[16px] border bg-surface px-9 py-7"
        }
        style={
          confirmation
            ? undefined
            : {
                borderColor: "rgba(55,53,47,.07)",
                // Three shadows rather than one: a wide soft ground shadow, a
                // tighter one to seat the card on it, and a hairline of white
                // along the top edge so it catches the light instead of
                // sitting flat on the grey.
                boxShadow:
                  "0 24px 60px -20px rgba(15,15,15,.14), 0 2px 8px rgba(15,15,15,.05), inset 0 1px 0 #fff",
              }
        }
      >
        {inner}
      </div>
    </div>
  );

  if (variant === "centered") {
    return (
      <div className="flex min-h-screen justify-center" style={{ background: "var(--canvas)" }}>
        {form}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--canvas)" }}>
      {panel}
      {form}
    </div>
  );
}

/** 2.1's envelope and 3.3's tick: a round mark above the heading. */
function AuthGlyph({ mark, tone }: { mark: string; tone: "accent" | "success" }) {
  return (
    <span
      className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[22px]"
      style={{
        background: tone === "success" ? "var(--success-bg)" : "var(--accent-tint)",
        color: tone === "success" ? "var(--success-fg)" : "var(--accent)",
      }}
      aria-hidden
    >
      {mark}
    </span>
  );
}

/**
 * The dark column. Every auth screen sets its own headline, its own line of
 * argument and its own three claims; the frame around them never changes.
 *
 * `children` is for the two screens that put a drawing above the claims rather
 * than only words: Sign In's request card and Sign Up's drafted plan.
 */
export function AuthPanel({
  heading,
  blurb,
  claims,
  children,
}: {
  heading: string;
  blurb: string;
  claims: { term: string; detail: string }[];
  children?: React.ReactNode;
}) {
  return (
    <aside className="pa-auth-panel hidden flex-1 items-center justify-center px-[72px] py-16 lg:flex">
      <AuthAtmosphere />
      <div className="relative z-[1] flex w-full max-w-[480px] flex-col gap-8">
      {/* Each block a beat behind the one above it. The delays are what make
          this read as opening rather than as three things that happened to
          appear together. */}
      <div className="pa-rise flex flex-col gap-3">
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "rgba(255,255,255,.45)" }}
      >
        Private Attaché
      </div>

      <h2
        className="max-w-[440px] text-[36px] font-bold leading-[1.12] tracking-[-0.8px] text-pretty"
        style={{ color: "#fff" }}
      >
        {heading}
      </h2>

      <p
        className="max-w-[420px] text-[15px] leading-[1.6]"
        style={{ color: "rgba(255,255,255,.62)" }}
      >
        {blurb}
      </p>
      </div>

      {children ? (
        <div className="pa-rise" style={{ animationDelay: "110ms" }}>
          {children}
        </div>
      ) : null}

      {claims.length > 0 ? (
        <div
          className="pa-rise mt-1.5 flex max-w-[440px] flex-col"
          style={{ animationDelay: "210ms" }}
        >
          {claims.map((claim, index) => (
            <div
              key={claim.term}
              className="flex items-center justify-between gap-6 py-3.5"
              style={{
                borderTop: "1px solid rgba(255,255,255,.12)",
                borderBottom:
                  index === claims.length - 1 ? "1px solid rgba(255,255,255,.12)" : undefined,
              }}
            >
              <span className="text-[13.5px]" style={{ color: "rgba(255,255,255,.75)" }}>
                {claim.term}
              </span>
              <span className="text-right text-[13.5px]" style={{ color: "rgba(255,255,255,.5)" }}>
                {claim.detail}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      </div>
    </aside>
  );
}
