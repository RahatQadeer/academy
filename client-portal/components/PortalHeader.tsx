import { headers } from "next/headers";
import Link from "next/link";
import { after } from "next/server";
import { Avatar } from "@/base/components/Avatar";
import { PortalNotifications } from "@/client-portal/components/PortalNotifications";
import { HeaderSearch } from "@/client-portal/components/HeaderSearch";
import { unreadIn } from "@/whitbyos/lib/notifications";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { portalAvatarUrl } from "@/client-portal/lib/data/avatars";
import { listPortalNotices } from "@/client-portal/lib/data/notifications";
import { readAllPortalNotices, readPortalNotice } from "@/client-portal/lib/actions/notifications";
import { syncGmailIfStale } from "@/client-portal/lib/integrations/gmail";
import { syncOutlookMailIfStale } from "@/client-portal/lib/integrations/outlook-mail";
import { portalPageTitle } from "@/client-portal/lib/page-title";

/**
 * The portal's top bar: who you are, search, the bell and the way out.
 *
 * Same bell as Whitby's, reading the other half of `whitbyos_notifications`:
 * rows addressed to the contact this login is rather than to a workspace
 * member. The professional side has been writing those since whitbyos/052 —
 * a deletion ask, its answer, an invoice going out — and until this there was
 * nowhere in the portal they could be read.
 *
 * The bar is Whitby's bar, down to the chrome it is painted in. It held a
 * search and a bell floating on a translucent strip while the professional's
 * held an identity chip, a search, a bell and Sign out on the rail's own
 * colour — two products whose top-left corners did not look like the same
 * frame. What differs now is only what a client has: no Quick Add, because a
 * client creates one thing and does it from Requests; no workspace switcher,
 * because there is one account.
 *
 * The chip is the reader rather than the client being read. Whitby's says
 * whose work is on the screen, which on this side never changes — so it says
 * who is signed in, and opens the screen that changes the photograph in it.
 *
 * It is also the only place the portal says it. The rail's footer used to
 * carry the same face and name under the nav; it does not any more, because
 * this bar is on every screen and a collapsed rail is the first thing to go.
 *
 * The bell is drawn only for a live session. The sample account has no
 * contact, so its bell could only ever say "Nothing yet", which is a claim
 * about an account that does not exist. Everything else on the bar works on
 * sample data like anything else.
 *
 * THE OTHER HALF
 *
 * The left end carries the screen's own title, and the way back off a detail
 * screen — see `lib/page-title.ts` for why they are here rather than at the top
 * of each page, and what that gave back. The two halves never meet: the title
 * takes the room that is left after the controls have taken theirs, and
 * truncates rather than pushing them.
 *
 * `slug` is the portal path this bar is drawn over, which is why this component
 * is rendered from the layout at that segment rather than from the product's.
 * A layout only re-renders when its own segment changes, so a bar drawn one
 * level up would still be saying "Requests" after the client had opened one.
 */
export async function PortalHeader({ slug }: { slug: string[] }) {
  const context = await getPortalContext();
  const live = context.mode === "live";

  const [notices, head, photo, page] = await Promise.all([
    live ? listPortalNotices() : Promise.resolve([]),
    headers(),
    // Cached per request — the rail asks for the same face in the layout.
    portalAvatarUrl(context.contactId),
    portalPageTitle(slug),
  ]);
  const here = head.get("x-pa-pathname") || "/client-portal";

  /*
   * Keep a connected mailbox current, after this page has been sent — what
   * Whitby's header does for the practice's mailbox. Throttled to once every
   * ten minutes inside, because each new message read is a model call.
   *
   * Both are asked: a client may have connected either, or both. Neither does
   * any work when its provider is not connected, and the throttle is per
   * mailbox.
   *
   * This is the background half only. It runs *after* the response, so what it
   * finds appears on the next visit rather than this one — which is why the
   * mailbox screens also carry a Sync now that reads while the client waits.
   */
  if (live && context.contactId && context.areas.integrations) {
    const contactId = context.contactId;
    after(() => syncGmailIfStale(contactId));
    after(() => syncOutlookMailIfStale(contactId));
  }

  return (
    <div
      className="pa-print-hide sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-5 lg:px-6"
      /*
       * The rail's own colour, and solid — see the same note on Whitby's bar.
       * The two pieces of chrome that meet at the top-left corner of every
       * screen have to be one material, and a tint that has to match another
       * tint cannot be part-transparent over whatever is scrolling underneath.
       */
      style={{
        borderColor: "var(--chrome-line)",
        background: "var(--chrome)",
      }}
    >
      {/*
       * The screen, named. On a phone it starts clear of the drawer's menu
       * button, which the rail fixes over this same corner at 16px + 34px.
       */}
      <div className="flex min-w-0 flex-1 items-center pl-[42px] md:pl-0">
        {/*
         * The same object as the identity chip at the other end of the bar —
         * see `.cp-bar-name`. Where there is a way back it lives inside the
         * capsule rather than beside it, so a detail screen's bar is one
         * chip that says where you are and how to leave, not two.
         */}
        <div className={`cp-bar-name${page.back ? " has-back" : ""}`}>
          {page.back ? <BackMark href={page.back.href} label={page.back.label} /> : null}

          {/* The two pieces of text sit on one baseline inside a chip that is
              centred as a whole — otherwise the disc beside them would drag
              the capsule's alignment off. */}
          <span className="flex min-w-0 items-baseline gap-2">
            <h1 className="min-w-0 truncate text-[14.5px] font-semibold tracking-[-0.2px]">
              {page.title}
            </h1>

            {/* The day on Home, the plan a stream belongs to on a stream.
                First thing to go when the window narrows: it is context, not
                the name of what is being read. */}
            {page.note ? (
              <span
                className="hidden min-w-0 shrink truncate text-[12px] lg:block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {page.note}
              </span>
            ) : null}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2" data-tour="header-actions">
        {/*
         * Who is signed in, on the bar that is on every screen. Pressing it
         * opens Profile, which is where the photograph in it is changed.
         */}
        <Link
          href="/client-portal/settings/profile"
          title={`${context.displayName} · ${context.roleLabel}`}
          aria-label="Open your profile"
          className="cp-bar-chip flex min-w-0 items-center gap-[9px] rounded-full py-[4px] pl-[4px] pr-4 no-underline hover:shadow-[0_2px_8px_-2px_rgb(var(--shade-rgb) / .2)]"
          style={{
            background: "var(--surface)",
            color: "var(--ink)",
            border: "1px solid var(--chrome-line)",
            boxShadow: "0 1px 2px rgb(var(--shade-rgb) / .06)",
          }}
        >
          <Avatar name={context.displayName} size={26} src={photo} />
          {/*
           * The name, and nothing beside it.
           *
           * The chip used to carry a tan "PRIMARY MEMBER" tag as well. What a
           * person is on the account is a fact about permissions — it changes
           * which nav items exist and nothing a client does on this bar — and
           * it was shouting it in uppercase on every screen, next to the one
           * thing the chip is for. It is still on Profile & Settings, which is
           * where somebody goes to ask it.
           *
           * Narrower on a phone, where the bar also carries the drawer's menu
           * button in its left end and four controls in its right.
           */}
          <span className="max-w-[104px] truncate text-[13px] font-medium sm:max-w-[160px]">
            {context.displayName}
          </span>
        </Link>

        <HeaderSearch />

        {live ? (
          <PortalNotifications
            notices={notices}
            unread={unreadIn(notices)}
            here={here}
            readAll={readAllPortalNotices}
            readOne={readPortalNotice}
          />
        ) : null}

        {/*
         * Last on the bar, and the only thing on it separated by a rule — the
         * same place Whitby keeps it, for the same reason. It ends the session,
         * and a control that does that should not sit flush against the one
         * that opens a search. The rail gives it up in return: two places to
         * sign out is one more than anybody looks in.
         */}
        <form
          action="/auth/sign-out"
          method="post"
          className="ml-1 border-l pl-3"
          style={{ borderColor: "var(--chrome-line)" }}
        >
          <button type="submit" title="Sign out" aria-label="Sign out" className="pa-bar-btn">
            <SignOutMark />
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * The bar's own shape, with nothing in it yet.
 *
 * The bar reads the bell, the client's face and the name of the screen before
 * it can draw, and it is above the boundary a screen's own skeleton waits at —
 * so without this, a navigation would show nothing at all until those reads
 * came back, skeleton included. Streamed in behind it instead: the band, its
 * colour and its exact height land in the first byte, and the contents arrive
 * where they will sit. Nothing moves when they do.
 */
export function PortalHeaderFallback() {
  return (
    <div
      className="pa-print-hide sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b px-4 py-2.5 sm:px-6 lg:px-8"
      style={{ borderColor: "var(--chrome-line)", background: "var(--chrome)" }}
      aria-hidden
    >
      {/* Holds the 36px the controls will, so the band is its own height. */}
      <span className="pa-skeleton block h-[14px] w-[132px] rounded-[4px]" />
      <span className="block h-9 w-0" />
    </div>
  );
}

/**
 * The way back, at the size a bar can afford.
 *
 * It replaces "← Back to Requests", which was a full line of its own above
 * every detail screen's heading — a sentence spending 30px of the fold to say
 * what an arrow says. Here it is a 30px disc against the heading it belongs to,
 * and the sentence survives as the label a screen reader and a tooltip get.
 *
 * It sits inside the name capsule rather than beside it, drawn in the bar's
 * own colour so it reads as a well cut into the white chip — the same
 * relationship the avatar has to the identity chip at the other end.
 */
function BackMark({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      title={`Back to ${label}`}
      aria-label={`Back to ${label}`}
      className="cp-bar-back flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full no-underline"
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M10 3.2 5.2 8l4.8 4.8"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

/**
 * A door with an arrow leaving it, drawn rather than set as a character — the
 * same mark the professional's bar and base's rail both draw, at the size this
 * bar's buttons use.
 */
function SignOutMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.2 13.4H3.6a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1h2.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 10.8 12.4 8 9.6 5.2M12.4 8H6.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
