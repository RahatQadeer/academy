"use client";

import { usePathname } from "next/navigation";
import { MessagesScreenSkeleton } from "@/client-portal/messages/components/MessagesSkeleton";

/**
 * What a screen looks like while it is on its way.
 *
 * This sits beside the slug dispatcher rather than inside any one product, so
 * it is wrapped by `[product]/layout` and keeps the sidebar, the switcher and
 * Quick Add exactly where they were — only the content area is replaced. Every
 * product passes through here, so the shape is deliberately generic: a title,
 * a line under it, and rows. Guessing at any one screen's real layout would
 * make the arrival jump.
 *
 * base added an Academy-shaped skeleton here on 2026-09-03 — a header, four
 * stat cards and a list. This one file serves all four products, and a
 * `loading.tsx` receives no params, so it cannot tell which one it is above.
 * An Academy skeleton would therefore flash on Whitby, the Client Portal and
 * Partner Center too. Kept generic; Academy's version belongs inside a route
 * segment of its own, where it would only apply to Academy.
 *
 * Held back 120ms. Most navigations inside the app are faster than that, and a
 * skeleton that flashes and vanishes reads as a glitch rather than as progress.
 *
 * Three exceptions, and none is a guess. Whitby's settings screens and its
 * Workspace Overview both lay a cover over the whole window, rail and bar
 * included — the first because those screens belong to the firm rather than
 * to a client, the second because choosing a client workspace is not a thing
 * you do from inside one. The generic skeleton was drawn *inside* the shell,
 * so opening either of them flashed the sidebar and a table back into view
 * for as long as the real screen took to arrive. The Client Portal's Messages
 * is the third: a full-height panel — a list beside a conversation beside a
 * composer — and a title over table rows standing in for it is exactly the
 * arrival that jumps.
 *
 * A `loading.tsx` gets no params, but it may be a Client Component — and
 * during a navigation the pathname is already the one being opened, which is
 * enough to know which of the three is coming. That is the only reason this
 * file is a client component.
 */
export default function Loading() {
  const here = usePathname();

  // The workspace's own settings open inside the shell, so they keep the
  // shell's skeleton; the firm's cover the window and get a cover.
  const workspaceSettings = [
    "/whitbyos/settings/workspace",
    "/whitbyos/settings/notifications",
    "/whitbyos/settings/invoices",
    "/whitbyos/settings/archive",
  ].some((path) => here === path || here?.startsWith(`${path}/`));

  if (here?.startsWith("/whitbyos/settings") && !workspaceSettings) return <SettingsLoading />;
  if (here === "/whitbyos/workspaces") return <WorkspacesLoading />;

  if (here?.startsWith("/client-portal/messages")) {
    return (
      <div className="pa-skeleton-in h-full" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        <MessagesScreenSkeleton />
      </div>
    );
  }

  if (here?.startsWith("/academy/onboarding")) {
    return (
      <div className="min-h-[100dvh] bg-canvas" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  /*
   * The Client Portal titles its screens on the bar rather than at the top of
   * the page, and the bar is above this boundary — so a 22px title bar here
   * stands in front of nothing, and the real screen arrives by deleting it and
   * pulling everything up. Its own screens start on the line under the note.
   */
  const portal = here?.startsWith("/client-portal");

  return (
    <div
      className={portal ? "px-4 pb-10 pt-5 sm:px-5 lg:px-6" : "px-12 py-9"}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>

      <div className="pa-skeleton-in flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          {portal ? (
            <Bar width={330} height={12} />
          ) : (
            <div className="flex flex-col gap-2.5">
              <Bar width={220} height={22} />
              <Bar width={330} height={12} />
            </div>
          )}
          <Bar width={132} height={34} radius={6} />
        </div>

        <div className="flex flex-col overflow-hidden rounded-card border border-line">
          {[0, 1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="flex items-center gap-6 border-b border-line px-4 py-[15px] last:border-b-0"
            >
              <Bar width="34%" height={12} />
              <Bar width="18%" height={12} />
              <Bar width={70} height={16} radius={4} />
              <Bar width={60} height={6} radius={3} />
              <Bar width={54} height={12} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bar({
  width,
  height,
  radius = 4,
  strong,
}: {
  width: number | string;
  height: number;
  radius?: number;
  /** For bars that sit on a tinted ground rather than on a white card. */
  strong?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`${strong ? "pa-skeleton-strong" : "pa-skeleton"} block shrink-0`}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

/**
 * The settings cover, without its contents: the same ground, the same header
 * band, the same rail and panel. Nothing here moves when the real screen
 * arrives.
 */
function SettingsLoading() {
  return (
    <div
      className="pa-skeleton-in fixed inset-0 z-50 overflow-y-auto"
      aria-busy="true"
      aria-live="polite"
      style={{
        background:
          "radial-gradient(1100px 520px at 18% -8%, #ffffff 0%, rgba(255,255,255,0) 62%), linear-gradient(180deg, #f3f5f9 0%, #eef1f6 100%)",
      }}
    >
      <span className="sr-only">Loading</span>

      {/* The header band the real screen draws: the mark, the firm, the area
          it is in, and Done at the far end. */}
      <div
        className="flex items-center justify-between gap-4 border-b px-8 py-3"
        style={{ background: "var(--surface)", borderColor: "var(--chrome-line)" }}
      >
        <div className="flex items-center gap-2.5">
          <Bar width={32} height={32} radius={9} />
          <Bar width={92} height={14} />
          <Bar width={86} height={12} />
        </div>
        <Bar width={72} height={32} radius={6} />
      </div>

      <div className="mx-auto flex max-w-[1060px] gap-9 px-8 py-8">
        {/* The rail is a card on the real screen, with seven rows at the
            height a tab actually is — bars adrift on the wash were what made
            it look half-drawn. */}
        <div
          className="flex h-fit w-[208px] shrink-0 flex-col gap-0.5 rounded-[14px] border p-2"
          style={{
            background: "var(--surface)",
            borderColor: "var(--chrome-line)",
            boxShadow: "0 1px 2px rgba(31,72,125,.05), 0 12px 32px -24px rgba(31,72,125,.35)",
          }}
        >
          {[112, 66, 152, 128, 108, 96, 74].map((width, row) => (
            <div key={row} className="flex h-[33px] items-center px-2">
              <Bar width={width} height={12} />
            </div>
          ))}
        </div>

        {/* And the panel: a title, a rule, then the labelled fields every one
            of these screens is made of. */}
        <div
          className="min-w-0 flex-1 rounded-[14px] border bg-surface px-8 py-7"
          style={{
            borderColor: "var(--chrome-line)",
            boxShadow: "0 1px 2px rgba(31,72,125,.05), 0 12px 32px -22px rgba(31,72,125,.4)",
            maxWidth: 704,
          }}
        >
          <div className="flex items-center gap-2">
            <Bar width={168} height={22} />
            <Bar width={22} height={22} radius={99} />
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            <Bar width="78%" height={11} />
            <Bar width="54%" height={11} />
          </div>

          <div className="mb-5 mt-6 border-t border-line" />

          <div className="flex flex-col gap-2">
            <Bar width={196} height={14} />
            <Bar width="86%" height={11} />
          </div>

          <div className="mt-5 flex flex-col gap-4">
            {[0, 1].map((row) => (
              <div key={row} className="flex gap-4">
                {[0, 1].map((cell) => (
                  <div key={cell} className="flex flex-1 flex-col gap-2">
                    <Bar width={row === 0 ? 96 : 118} height={11} />
                    <Bar width="100%" height={38} radius={6} />
                  </div>
                ))}
              </div>
            ))}

            <div className="flex flex-col gap-2">
              <Bar width={104} height={11} />
              <Bar width="100%" height={64} radius={6} />
            </div>
          </div>

          <div className="mt-7 flex justify-end border-t border-line pt-5">
            <Bar width={116} height={36} radius={6} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Workspace Overview, without its contents: the same rail, header and card
 * shelf the real screen uses. The old navy band was a previous chrome, and
 * flashing it for two seconds on the way in read as going backwards.
 */
function WorkspacesLoading() {
  return (
    <div
      className="ws-overview pa-skeleton-in fixed inset-0 z-50 flex"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>

      <aside className="ws-overview-rail relative hidden w-[272px] shrink-0 flex-col lg:flex">
        <div className="ws-rail-brand flex items-center gap-2.5 px-3 pb-3.5 pt-4">
          <Bar width={40} height={40} radius={12} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bar width="72%" height={14} />
            <Bar width="42%" height={10} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-1">
          <Bar width={88} height={10} />
          <Bar width={32} height={32} radius={10} />
        </div>
        <div className="flex flex-col gap-1.5 px-2 pt-2">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-2.5 rounded-[12px] px-2 py-2">
              <Bar width={32} height={32} radius={10} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Bar width={row === 0 ? "70%" : "58%"} height={12} />
                <Bar width="40%" height={9} />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="ws-overview-header relative z-10 shrink-0">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="hidden h-7 w-[3px] shrink-0 rounded-full sm:block"
                style={{
                  background:
                    "linear-gradient(180deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 35%, transparent) 100%)",
                }}
              />
              <Bar width={168} height={16} />
            </div>
            <div className="flex items-center gap-2">
              <Bar width={148} height={32} radius={6} />
              <Bar width={36} height={36} radius={999} />
            </div>
          </div>
        </header>

        <div className="ws-overview-body min-h-0 flex-1 overflow-y-auto">
          <div className="mb-6 flex items-end justify-between gap-4 rounded-[16px] border bg-surface px-6 py-5" style={{ borderColor: "var(--chrome-line)" }}>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Bar width={240} height={22} />
              <Bar width="62%" height={12} />
            </div>
            <Bar width={132} height={36} radius={6} />
          </div>
          <div className="mb-5 grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((cell) => (
              <div
                key={cell}
                className="flex min-h-[148px] flex-col gap-2.5 rounded-[12px] border bg-surface px-4 py-4"
                style={{ borderColor: "var(--chrome-line)" }}
              >
                <Bar width={28} height={28} radius={8} />
                <Bar width={36} height={22} radius={5} />
                <Bar width="62%" height={12} />
              </div>
            ))}
          </div>

          <div className="grid w-full gap-3 lg:grid-cols-2">
            {[0, 1].map((panel) => (
              <div
                key={panel}
                className="rounded-[14px] border bg-surface p-4"
                style={{ borderColor: "var(--chrome-line)" }}
              >
                <Bar width={120} height={14} />
                <div className="mt-4 flex flex-col gap-3">
                  <Bar width="88%" height={11} />
                  <Bar width="64%" height={11} />
                  <Bar width="72%" height={11} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
