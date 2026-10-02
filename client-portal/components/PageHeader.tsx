/**
 * What a screen says before its contents: the line explaining it, and the one
 * control that makes something.
 *
 * The title is not here any more. It is on the top bar, which is drawn over
 * every screen with its left half empty — see `lib/page-title.ts`. What is left
 * is the part of a page header that was never a duplicate of the nav item that
 * opened it: Documents' "Internal files always stay with your team", Requests'
 * "+ New Request".
 *
 * Both are optional and most screens pass one. With neither, nothing is drawn
 * at all and the page's own contents start at the top of the body — which is
 * the point of the exercise.
 *
 * The note is measured at `max-w-2xl` rather than by the page, and the action
 * shares its row rather than sitting on one of its own: on a screen with both,
 * the two together cost one line instead of the three a heading, a subtitle and
 * a button used to.
 */
export function PageIntro({
  note,
  action,
}: {
  note?: React.ReactNode;
  action?: React.ReactNode;
}) {
  if (!note && !action) return null;

  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      {note ? (
        <p
          className="min-w-0 max-w-2xl flex-1 text-[13.5px] leading-relaxed"
          style={{ color: "var(--text-soft)" }}
        >
          {note}
        </p>
      ) : (
        // Holds the left of the row so a lone action stays at the right edge.
        <span className="flex-1" />
      )}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Title, optional subtitle, optional right-aligned action.
 *
 * No longer the top of a portal screen — the bar carries that. What still uses
 * it is the two places a heading is not the name of the screen it is on:
 * onboarding, whose steps are five headings inside one overlay that covers the
 * shell and its bar entirely, and a settings pane, which is a card beside a
 * rail of five other cards and has to say which one it is.
 *
 * `size` and `gap` are passed rather than fixed, the way Whitby passes them.
 * Every screen here drew its title at 26px with 20px beneath, which is the
 * Requests heading applied to screens that are not Requests: a settings pane
 * with four fields on it was announcing itself as loudly as the client's whole
 * list of work. The scale in use:
 *
 *   Home, Requests                    26px, 20px beneath
 *   Forms, Documents, Messages,
 *     Calendar, Updates, Billing      24px, 22px
 *   Settings panes, Onboarding        22px, with a subtitle instead of a gap
 *
 * A subtitle replaces the gap rather than adding to it: the heading sits 6px
 * above its line of description, and the air comes after that, so the two read
 * as one block rather than as a heading floating over a paragraph.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  size = 24,
  gap = 22,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  size?: 20 | 22 | 24 | 26;
  gap?: number;
}) {
  return (
    <div style={{ marginBottom: subtitle ? 26 : gap }}>
      <div className="flex items-center justify-between gap-4">
        <h1
          className="min-w-0 truncate font-bold leading-tight tracking-[-0.3px]"
          style={{ fontSize: size, marginBottom: subtitle ? 6 : 0 }}
        >
          {title}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {subtitle ? (
        <p
          className="max-w-2xl text-[13.5px] leading-relaxed"
          style={{ color: "var(--text-soft)" }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The page frame.
 *
 * THE GUTTER
 *
 * 24px, not the 48px it was. Whitby's number, taken when the portal's screens
 * were centred paragraphs; on a rail-plus-panel layout it is a second margin
 * outside the panel's own, so every list on every screen started an inch and a
 * half from the rail with nothing in between. The bar above uses the same
 * number now, which is the other half of it: the screen's name sits directly
 * over the left edge of the screen it names.
 *
 * The top padding is 20px rather than the 36px it was on the other sides. The
 * screen used to open with a heading, which wanted air above it; it opens with
 * its contents now, and the bar above them is already a band of chrome — 36px
 * more of nothing under it read as the page having failed to load rather than
 * as space.
 *
 * Full-bleed with 48px gutters, matching Whitby. The portal used to centre
 * every screen in 980px, which was chosen when its screens were short
 * paragraphs and a handful of rows. It is the wrong frame for a table: a
 * six-column list of documents in 980px on a 1600px display truncates three of
 * the columns while half the screen sits empty either side.
 *
 * Prose is measured at the block that holds it — `max-w-2xl` on a subtitle, on
 * a note, on a description — rather than by narrowing the page, so a line of
 * text stays readable without deciding the width of the tables around it.
 *
 * `narrow` is the exception, for the screens that are entirely a single column
 * of fields: onboarding, and a settings pane. There is nothing on those to fill
 * a wide page with, and a lone 420px form column pinned to the left edge of a
 * wide screen reads as a rendering fault.
 */
export function PageBody({
  children,
  narrow = false,
}: {
  children: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <div
      className={
        narrow
          ? "mx-auto max-w-[760px] px-8 pb-10 pt-6"
          : "px-4 pb-10 pt-5 sm:px-5 lg:px-6"
      }
    >
      {children}
    </div>
  );
}
