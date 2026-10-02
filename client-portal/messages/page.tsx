import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { listThreads } from "@/client-portal/lib/data/messages";
import { listRequests } from "@/client-portal/lib/data/requests";
import { listMessageablePeople } from "@/client-portal/lib/data/people";
import { flag, param, tabParam, type ScreenProps } from "@/client-portal/lib/routing";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { ThreadRail } from "./components/ThreadList";
import { isGroup, messagesHref, type RailKind } from "./components/rail";
import { ThreadView } from "./components/ThreadView";
import { LiveMessages } from "./components/LiveMessages";
import { NewConversationModal } from "./components/NewConversationModal";
import { MessagesFrame, PANEL_CLASS, PANEL_SHADOW } from "./components/MessagesSkeleton";

const TABS = ["conversations", "unread", "by-request"] as const;

/**
 * Messages, drawn in Whitby's layout: one panel set into the page, the list of
 * conversations on the left and the open one beside it.
 *
 * The list scrolls on its own and the conversation scrolls on its own, so the
 * composer is always where your hands are.
 *
 * DIRECT AND GROUP
 *
 * As on Whitby's side, a conversation with one other person is Direct and one
 * with several is a Group (`?kind=group`). The portal has no separate kind on
 * the thread, so it is read from who is on it.
 *
 * BELOW `lg`, ONE THING AT A TIME
 *
 * Two columns do not fit a tablet, let alone a phone. The list fills the panel
 * until a conversation is chosen, and then the conversation does, with a back
 * control to the list. That is decided by whether `thread` is in the URL, not by
 * the fallback selection a wide screen makes, so a phone never opens straight
 * into a conversation it was not asked for.
 */
export default async function MessagesScreen({ searchParams }: ScreenProps) {
  const tab = tabParam(searchParams, TABS, "conversations");
  const kind: RailKind = param(searchParams, "kind") === "group" ? "group" : "direct";
  const selectedId = param(searchParams, "thread");
  const search = (param(searchParams, "q") ?? "").trim();
  const request = param(searchParams, "request") ?? "";

  const [context, threads] = await Promise.all([getPortalContext(), listThreads()]);

  // Starting a conversation is a write, so a view-only member is offered none.
  // `startConversation` refuses them independently.
  const mayStart = !context.viewOnly;
  const composing = flag(searchParams, "new") && mayStart;

  // Only fetched when the composer is actually open. `listRequests` is gated on
  // the Requests area, so a client without it gets a composer with no picker.
  const [requests, people] = composing
    ? await Promise.all([listRequests(), listMessageablePeople()])
    : [[], []];

  const ofKind = threads.filter((thread) => (kind === "group") === isGroup(thread));
  const inTab =
    tab === "unread"
      ? ofKind.filter((thread) => thread.unread)
      : tab === "by-request"
        ? ofKind.filter((thread) => thread.requestId)
        : ofKind;

  // Looked up across every thread, not just the ones this tab lists: opening a
  // thread on the Unread tab marks it read, which takes it out of the tab, and
  // it must stay on screen rather than the pane jumping to another conversation.
  const explicit = selectedId ? threads.find((thread) => thread.id === selectedId) : undefined;
  const selected = explicit ?? inTab[0] ?? null;
  const open = Boolean(explicit);

  const listHref = messagesHref({
    kind,
    tab,
    q: search || undefined,
    request: request || undefined,
  });
  const newHref = mayStart ? `${listHref}${listHref.includes("?") ? "&" : "?"}new=1` : null;

  return (
    <MessagesFrame notice={<DataNotice context={context} />} compactOnMobile={open}>
      <div className={PANEL_CLASS} style={PANEL_SHADOW}>
        <aside
          aria-label="Conversations"
          className={cn(
            "min-h-0 w-full flex-col lg:flex lg:w-[344px] lg:shrink-0 lg:border-r",
            open ? "hidden" : "flex",
          )}
          style={{ background: "var(--surface)", borderColor: "var(--chat-line)" }}
        >
          <ThreadRail
            threads={inTab}
            activeId={selected?.id}
            kind={kind}
            tab={tab}
            initialQuery={search}
            initialRequest={request}
            counts={{
              open: ofKind.length,
              unread: ofKind.filter((thread) => thread.unread).length,
              byRequest: ofKind.filter((thread) => thread.requestId).length,
              unreadElsewhere: threads.some(
                (thread) => thread.unread && (kind === "group") !== isGroup(thread),
              ),
            }}
            newHref={newHref}
          />
        </aside>

        <section
          aria-label="Conversation"
          className={cn("min-h-0 min-w-0 flex-1 flex-col lg:flex", open ? "flex" : "hidden")}
          style={{ background: "var(--chat-ground)" }}
        >
          {selected ? (
            <ThreadView
              thread={selected}
              timezone={context.timezone}
              canReply={!context.viewOnly}
              backHref={listHref}
              newHref={newHref}
            />
          ) : (
            <NothingOpen empty={threads.length === 0} group={kind === "group"} newHref={newHref} />
          )}
        </section>
      </div>

      {composing ? (
        <NewConversationModal closeHref={listHref} requests={requests} people={people} />
      ) : null}

      <LiveMessages enabled={context.mode === "live"} contactId={context.contactId} />
    </MessagesFrame>
  );
}

/**
 * The two thirds of the screen nobody is using yet: a mark, a sentence and the
 * one action — Whitby's empty pane.
 */
function NothingOpen({
  empty,
  group,
  newHref,
}: {
  empty: boolean;
  group: boolean;
  newHref: string | null;
}) {
  return (
    <div className="cp-fade-up flex flex-1 flex-col items-center justify-center px-10 text-center">
      <span
        aria-hidden
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] text-[20px]"
        style={{ background: "var(--chat-them)", color: "var(--accent)" }}
      >
        ✉
      </span>
      <p className="m-0 text-[15px] font-semibold" style={{ color: "var(--chat-ink)" }}>
        {empty ? "No conversations yet" : "Pick a conversation"}
      </p>
      <p
        className="mt-1.5 max-w-[340px] text-[13px] leading-[1.55]"
        style={{ color: "var(--chat-muted)" }}
      >
        {empty
          ? newHref
            ? "Messages between you and your team appear here. Start one whenever you have something to ask."
            : "Messages between you and your team appear here. Your team can start one from any request."
          : group
            ? "Choose a group from the list to read it and reply."
            : "Choose one from the list to read it and reply."}
      </p>
      {newHref ? (
        <Link
          href={newHref}
          className="mt-5 rounded-control px-4 py-[9px] text-[13.5px] font-medium no-underline hover:text-white"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          New conversation
        </Link>
      ) : null}
    </div>
  );
}
