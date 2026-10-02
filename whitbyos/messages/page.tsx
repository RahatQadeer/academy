import Link from "next/link";
import { Button } from "@/base/components/Button";
import { cn } from "@/base/lib/cn";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import {
  AddParticipantDialog,
  AddToRequestDialog,
  ArchiveConversationDialog,
  ConversationSettingsDialog,
  DeleteGroupDialog,
  NewDirectDialog,
  NewThreadDialog,
} from "@/whitbyos/messages/components/MessageDialogs";
/* The one New Task there is, rather than a smaller one of this screen's own:
   a task made from a conversation is a task, with the same plan, stream,
   people, dates and drafted steps as any other. */
import { NewTaskDialog } from "@/whitbyos/tasks/components/NewTaskDialog";
import { listWorkstreamOptions } from "@/whitbyos/lib/tasks";
import { listAssignees } from "@/whitbyos/lib/work-plans";
import { RequestFilter } from "@/whitbyos/messages/components/RequestFilter";
import { ThreadMenu } from "@/whitbyos/messages/components/ThreadMenu";
import { Conversation } from "@/whitbyos/messages/components/Conversation";
import { ThreadSearch } from "@/whitbyos/messages/components/ThreadSearch";
import { ConversationSearch } from "@/whitbyos/messages/components/ConversationSearch";
import { LiveMessages } from "@/whitbyos/messages/components/LiveMessages";
import { MarkRead } from "@/whitbyos/messages/components/MarkRead";
import { openGeneralThread } from "@/whitbyos/messages/actions";
import { SubmitPlain } from "@/base/components/Submit";
import {
  getThread,
  listRecipients,
  listThreads,
  type MessageFilter,
  type ThreadKind,
  type ThreadRow,
} from "@/whitbyos/lib/messages";
import { onRequest, requestsOf } from "@/whitbyos/lib/message-fold";
import { listRequestOptions } from "@/whitbyos/lib/tasks";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { initialsOf } from "@/whitbyos/lib/contact-vocab";
import { relativeTime } from "@/whitbyos/lib/format";
import { getSessionProfile } from "@/base/identity/session";

const LIST = "/whitbyos/messages";




/** The four avatar colourways the export cycles through. */
const FACE_TONES = [
  { background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" },
  { background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" },
  { background: "var(--avatar-green-bg)", color: "var(--avatar-green-fg)" },
  { background: "var(--avatar-orange-bg)", color: "var(--avatar-orange-fg)" },
];

/**
 * One round face, for a direct row and the heading above a direct thread.
 *
 * The colourway comes from the name rather than the row's position, so a person
 * keeps the same one everywhere and does not change colour as the list reorders.
 */
function Face({
  name,
  photo,
  size = 34,
}: {
  name: string;
  /** Their own, where they have added one. Initials are the fallback. */
  photo?: string | null;
  size?: number;
}) {
  const tone =
    FACE_TONES[
      [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % FACE_TONES.length
    ];

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{ ...tone, height: size, width: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {photo ? <Photo src={photo} /> : initialsOf(name)}
    </span>
  );
}

/**
 * Somebody's photo, filling the round frame the initials would have sat in.
 *
 * A signed URL on a private bucket, which `next/image` cannot fetch, so this
 * stays a plain img — and a Google account photo is refused outright when a
 * referrer is sent with the request.
 */
function Photo({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      referrerPolicy="no-referrer"
    />
  );
}

/**
 * The subject, but only when it says something the person's name does not.
 *
 * A direct thread is named after whoever it is with (`startDirect`), so its
 * subject is that name over again — printing both put the same words on two
 * lines of the same row. A real subject, the way the export's "Re: Visa
 * interview prep" is one, still gets its line.
 */
function subjectLine(thread: { subject: string; counterparty: string }) {
  const same =
    thread.subject.trim().toLowerCase() === thread.counterparty.trim().toLowerCase();

  return same ? null : thread.subject;
}

/**
 * The name above the open conversation.
 *
 * A direct thread leads with the person, the way a chat does: their face, their
 * name, and a second line only where there is something else to say. A group
 * leads with its own subject and says who is in it.
 */
function ThreadHeading({
  thread,
  photo,
  folded,
}: {
  thread: {
    subject: string;
    counterparty: string;
    counterpartyPhoto: string | null;
    photo: string | null;
    kind: ThreadKind;
    requestTitle: string | null;
    participantCount: number;
  };
  /**
   * The group's picture as the whole conversation knows it.
   *
   * It is stored per thread, and the thread a conversation is anchored to is
   * not always the one somebody put the picture on — so the group came up
   * wearing its initials on one thread and its own face on the next.
   */
  photo?: string | null;
  /**
   * Whether this is several threads read as one conversation — and then the
   * subject is not the conversation's. Each thread inside has its own, given
   * when it was started, and hanging whichever one is anchoring the chat
   * under the person's name says something that is only a third true. The
   * strip below names them properly.
   */
  folded?: boolean;
}) {
  const group = thread.kind === "group";
  const detail = [
    group ? thread.counterparty : folded ? null : subjectLine(thread),
    group ? `${thread.participantCount} people` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-w-0 items-center gap-3">
      {/* A group wears its own picture, or the initials of its name — the
          same mark the rail draws, so one is recognised as the other. */}
      {group ? (
        <Face name={thread.subject} photo={photo ?? thread.photo} />
      ) : (
        <Face name={thread.counterparty} photo={thread.counterpartyPhoto} />
      )}

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-[16px] font-bold">
            {group ? thread.subject : thread.counterparty}
          </h2>
          {/* Which of this person's conversations you are in. */}
          {thread.requestTitle ? <RequestChip title={thread.requestTitle} /> : null}
        </div>
        {detail ? (
          <p className="mt-[3px] truncate text-[12.5px]" style={{ color: "var(--chat-muted)" }}>
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}


/**
 * What sits in front of a row's last line.
 *
 * A draft says so, in the colour of something unfinished — the export puts
 * "Draft" where the time goes, which costs you the time and says nothing about
 * where the draft actually is. Otherwise, if the last word was yours, a tick
 * says whether they have opened it — which is how a chat list tells you whether
 * you are waiting on a reply or they are.
 *
 * A mark rather than the words the conversation itself now uses: this is a
 * 270px row that already carries a name, a time, a subject and a preview.
 */
function PreviewMark({ row }: { row: { draft: boolean; lastMine: boolean; lastRead: boolean } }) {
  if (row.draft) {
    return (
      <span className="shrink-0 font-medium" style={{ color: "var(--danger-text)" }}>
        Draft:
      </span>
    );
  }

  if (!row.lastMine) return null;

  return (
    <span
      className="shrink-0"
      style={{ color: row.lastRead ? "var(--accent)" : "var(--text-disabled)" }}
      title={row.lastRead ? "Read" : "Sent. Not opened yet."}
    >
      <Ticks double={row.lastRead} />
    </span>
  );
}

/**
 * One tick sent, two read — drawn, not typed.
 *
 * "✓✓" as characters is two glyphs with a word space between them at whatever
 * weight the font has for a check, which read as a stutter rather than as the
 * mark every chat uses. This is the mark: the second tick tucked behind the
 * first, and blue once it has been read.
 */
function Ticks({ double }: { double: boolean }) {
  return (
    <svg
      width={double ? 16 : 11}
      height="11"
      viewBox={double ? "0 0 16 11" : "0 0 11 11"}
      fill="none"
      aria-hidden
      className="inline-block align-[-1px]"
    >
      <path
        d="M1 6.2 3.6 8.8 9.4 2.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {double ? (
        <path
          d="M6.4 6.2 9 8.8 14.8 2.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

/**
 * Something said since you last opened it.
 *
 * A direct row wears this on the face it is with. A group has no one face, so
 * it goes where the eye already is — beside the time, which is the corner a
 * chat client puts its unread mark in.
 */
function UnreadDot({ ring }: { ring?: string }) {
  return (
    <span
      aria-label="Unread"
      title="New message"
      className="h-[9px] w-[9px] shrink-0 rounded-full"
      style={{
        background: "var(--danger-solid)",
        border: ring ? `2px solid ${ring}` : undefined,
      }}
    />
  );
}

/** The tray a conversation is put into — the mark a chat client uses. */
function ArchiveGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2.5" y="3.5" width="15" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M4 7.5v7.2c0 .9.7 1.6 1.6 1.6h8.8c.9 0 1.6-.7 1.6-1.6V7.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10 10v3.4m0 0L8.4 11.9M10 13.4l1.6-1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The work a conversation is about.
 *
 * A grey hairline chip at the bottom of a row read as a tag somebody had put
 * on it. It is the thing that tells two conversations with the same person
 * apart, so it wears the accent and sits where the eye lands.
 */
function RequestChip({ title }: { title: string }) {
  return (
    <span
      className="inline-block max-w-full truncate rounded px-[7px] py-px text-[11px] font-semibold"
      style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
      title={title}
    >
      {title}
    </span>
  );
}

/**
 * One of the threads inside a conversation, along its top.
 *
 * Tabs rather than chips: a row of outlined boxes read as four buttons of
 * equal weight over a conversation that is already the loudest thing on the
 * screen. So the rest are quiet text, and the strip needs no label above it
 * to say what it is — it is plainly the places this conversation can be read
 * in.
 *
 * The one being read is a filled ellipse. Accent text on a tinted header was
 * the same blue twice over and said "this one is a link", not "this one is
 * what you are reading"; which thread is open is the question the strip
 * exists to answer, so it is answered in the loudest way there is.
 *
 * A dot says somebody has said something in a thread you are not in: the
 * same mark the rail draws, because it is the same question.
 */
function ThreadPill({
  href,
  label,
  active,
  unread,
}: {
  href: string;
  label: string;
  active: boolean;
  unread: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex max-w-[200px] shrink-0 items-center gap-1.5 rounded-full px-[11px] py-[5px] text-[12.5px] no-underline transition-colors",
        !active && "hover:bg-[var(--surface-active)]",
      )}
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "#fff" : "var(--text-secondary)",
        fontWeight: active ? 600 : unread ? 600 : 450,
        boxShadow: active ? "0 1px 3px rgba(31,72,125,.28)" : undefined,
      }}
    >
      <span className="truncate">{label}</span>
      {unread && !active ? <UnreadDot /> : null}
    </Link>
  );
}

/**
 * How much of a conversation has not been read, on the row.
 *
 * A chat list says six, not "something" — the number is what decides which
 * row somebody opens first. It stands where the chips used to, at the end of
 * the line that says what was last said.
 *
 * In the product's own blue, the way WhatsApp's is green. A filled badge on
 * a quiet row is loud enough by itself, and red says something has gone
 * wrong when what is true is that somebody wrote to you.
 */
function UnreadCount({ count }: { count: number }) {
  return (
    <span
      className="ml-auto shrink-0 rounded-full px-[7px] py-[1px] text-[11px] font-bold tabular-nums"
      style={{ background: "var(--accent)", color: "#fff" }}
      aria-label={`${count} unread`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** A conversation read out of Archived says where it is being read from. */
function ArchivedChip() {
  return (
    <span
      className="inline-block rounded px-[7px] py-px text-[11px] font-medium"
      style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
    >
      Archived
    </span>
  );
}

const FILTERS: { value: MessageFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "request", label: "By Request" },
  { value: "drafts", label: "Drafts" },
  // Messages' own, not the workspace Archive — 089.
  { value: "archived", label: "Archived" },
];

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}


/**
 * Screens 9 through 9.5 — the inbox, its filters, and one conversation.
 *
 * Direct and Group are separate because they behave differently: §5.6 lets
 * someone join a group part-way and see it only from there, which has no
 * meaning for a two-person thread.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const tab = (one(searchParams?.tab) === "group" ? "group" : "direct") as ThreadKind;
  const filter = (FILTERS.find((f) => f.value === one(searchParams?.filter))?.value ??
    "all") as MessageFilter;

  const threadId = one(searchParams?.thread);
  const creating = one(searchParams?.new) === "1";
  const linking = one(searchParams?.link) === "1";
  const makingTask = one(searchParams?.task) === "1";
  const addingPerson = one(searchParams?.add) === "1";
  const settings = one(searchParams?.settings) === "1";
  const archiving = one(searchParams?.archive) === "1";
  const deleting = one(searchParams?.remove) === "1";
  /* "picture", "name" or "both" — what the settings panel just wrote. */
  const saved = one(searchParams?.saved);
  const put = one(searchParams?.put) === "1";
  const restored = one(searchParams?.restored) === "1";
  const deleted = one(searchParams?.deleted) === "1";
  /* One Request rather than "filed under any of them" — see RequestFilter. */
  const requestFilter = one(searchParams?.request) ?? "";
  const taskMade = one(searchParams?.taskmade);
  const linked = one(searchParams?.linked) === "1";
  /* "new" or "existing": which conversation the Request picker landed on. */
  const opened = one(searchParams?.opened);
  const error = one(searchParams?.error);
  const query = (one(searchParams?.q) ?? "").trim().toLowerCase();
  /* What the open conversation's own glass is looking for — the rail's `q`
     searches across conversations, this searches within one. */
  const find = (one(searchParams?.find) ?? "").trim();
  /*
   * Whose work this screen is showing is not this screen's question any more.
   * It is chosen once on Workspace Overview and answered the same way
   * everywhere — see `lib/open-client.ts`.
   */
  const client = (await getOpenClientId()) ?? "";

  const needsPeople = creating || addingPerson || settings;
  const needsRequests = creating || linking || makingTask;

  /*
   * The rail is read first because it is what decides how much of a
   * conversation the open one is.
   *
   * General talk with one person can be held on more than one thread; folded,
   * they are a single chat, and opening it has to read all of them. Only the
   * list knows which those are, so the transcript is asked for afterwards
   * rather than beside it.
   */
  const [result, requests, people, profile, clients, streams, assignees] =
    await Promise.all([
      listThreads(tab),
      needsRequests ? listRequestOptions() : Promise.resolve([]),
      needsPeople ? listRecipients() : Promise.resolve([]),
      // Only for the name and face on a message drawn before the server has
      // stored it.
      getSessionProfile(),
      listClientOptions(),
      // Only for New Task, which is the full one.
      makingTask ? listWorkstreamOptions() : Promise.resolve([]),
      makingTask ? listAssignees() : Promise.resolve([]),
    ]);

  const folded = result.ok ? result.threads : [];
  /** The row the open thread belongs to — itself, folded in, or inside it. */
  const rowOf = (id: string) =>
    folded.find(
      (row) =>
        row.id === id ||
        row.mergedIds.includes(id) ||
        row.children.some((child) => child.id === id),
    ) ?? null;

  const openRow = threadId ? rowOf(threadId) : null;
  /* Only the conversation itself is read as several threads. A Request thread
     inside it is one thread and reads as one. */
  const readAlso =
    openRow && openRow.mergedIds.includes(threadId ?? "") ? openRow.mergedIds : [];

  /* The only thing that had to wait for the list: which threads the open
     conversation is read from. */
  const thread = threadId ? await getThread(threadId, readAlso) : null;

  /*
   * The work of the client workspace that is open, and nobody else's.
   *
   * "Link to a Request" was offering every request in the firm while one
   * client was open, so a group about the Khans could be filed under the
   * Hartwells' visa. With all clients open it is everything, and then each one
   * says whose it is, because a title on its own does not.
   */
  const requestsHere = (client ? requests.filter((row) => row.clientId === client) : requests).map(
    (row) => ({
      id: row.id,
      title: client || !row.clientName ? row.title : `${row.title} · ${row.clientName}`,
    }),
  );

  const myName =
    profile?.user.preferred_name || profile?.user.full_name || "You";
  const myPhoto = profile?.user.avatar_url ?? null;

  // The client filter sits above the four below it, so it is applied first and
  // their counts are read off what it leaves. Counting the whole inbox under a
  // filter that hides most of it would put numbers beside labels that cannot
  // produce them.
  /*
   * The open client's conversations, and the firm's own.
   *
   * A conversation belonging to no client is internal — you and a teammate,
   * about nothing anybody is being billed for — and hiding it because a client
   * workspace is open loses it entirely: it belongs to no client's list, so
   * there is no list it would turn up in. The same rule the Calendar follows
   * for an event tied to nobody.
   */
  /* A person is one row whoever's work they were written to about, so the
     client filter asks the conversation and the threads inside it. */
  const scoped = folded.filter(
    (row) =>
      !client ||
      !row.clientId ||
      row.clientId === client ||
      row.children.some((child) => child.clientId === client),
  );

  /* Archived is counted on its own and left out of everything else: a
     conversation put away is not one of "12 conversations" any more. */
  const live = scoped.filter((row) => !row.archived);

  const counts: Record<MessageFilter, number> = {
    all: live.length,
    unread: live.filter((row) => row.unread).length,
    request: live.filter((row) => onRequest(row)).length,
    drafts: live.filter((row) => row.draft).length,
    archived: scoped.filter((row) => row.archived).length,
  };

  /* Every Request that actually has a conversation on this tab, named once —
     including the ones that are now threads inside a person's chat. */
  const requestOptions = [
    ...new Map(
      scoped.flatMap((row) => requestsOf(row).map((on) => [on.id, on.title] as const)),
    ),
  ].map(([id, title]) => ({ id, title }));

  const requestName = requestOptions.find((row) => row.id === requestFilter)?.title;

  const threads = result.ok
    ? scoped.filter((row) => {
        if (requestFilter && !requestsOf(row).some((on) => on.id === requestFilter)) {
          return false;
        }
        // Archived is a place of its own, and nothing else shows what is in it.
        if (filter === "archived" ? !row.archived : row.archived) return false;
        if (filter === "unread" && !row.unread) return false;
        if (filter === "request" && !onRequest(row)) return false;
        if (filter === "drafts" && !row.draft) return false;

        if (!query) return true;

        // Who it is with, what it is about, what was last said, and the work it
        // belongs to — the four things a row shows are the four it searches.
        return [
          row.counterparty,
          row.subject,
          row.preview,
          ...requestsOf(row).map((on) => on.title),
        ]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(query));
      })
    : [];

  /**
   * Why the rail is empty, which is rarely "you have no conversations".
   *
   * A filter or a search that matches nothing was telling people to go and
   * start their first conversation while one sat behind the filter they had
   * just clicked.
   */
  const clientName = clients.find((row) => row.id === client)?.name;

  const empty = requestFilter && requestName
    ? {
        title: `Nothing on ${requestName}`,
        detail:
          "No conversation on this tab is filed under that Request. Choose Any Request to see the rest.",
      }
    : clientName && counts.all === 0
    ? {
        title: `Nothing in ${clientName}`,
        detail:
          "No conversation belongs to this workspace. Choose All clients on Workspace Overview to see the rest.",
      }
    : query
    ? {
        title: "Nothing matches that",
        detail: `No conversation mentions "${query}". Clear the search to see the rest.`,
      }
    : filter === "unread"
      ? { title: "Nothing unread", detail: "Everything here has been opened." }
      : filter === "request"
        ? {
            title: "Nothing linked to a Request",
            detail:
              "Open a conversation and use Add to Request to tie it to the work it belongs to.",
          }
        : filter === "archived"
        ? {
            title: "Nothing archived",
            detail:
              "A conversation you put away is kept here, and comes back the moment somebody replies to it.",
          }
      : filter === "drafts"
          ? {
              title: "No drafts",
              detail: "A reply you start and leave unsent is kept here.",
            }
          : tab === "group"
            ? {
                title: "No group conversations yet",
                detail:
                  "Start a group to loop in multiple contacts or team members on one thread.",
              }
            : {
                title: "No conversations yet",
                detail:
                  "Start a conversation with a contact, a provider or someone on your team.",
              };

  const inWorkspace = client ? `&client=${encodeURIComponent(client)}` : "";
  const onOneRequest = requestFilter ? `&request=${encodeURIComponent(requestFilter)}` : "";
  const base = `${LIST}?tab=${tab}${
    filter === "all" ? "" : `&filter=${filter}`
  }${inWorkspace}${onOneRequest}`;
  const threadHref = (id: string) => `${base}&thread=${id}`;

  /*
   * Where a row in the rail opens.
   *
   * At the conversation itself — except under a Request filter, where the
   * question being asked is what this person said about that work, and the
   * answer is the thread inside them that holds it.
   */
  const opensAt = (row: ThreadRow) =>
    (requestFilter && requestsOf(row).find((on) => on.id === requestFilter)?.threadId) ||
    row.openAt;

  /**
   * The threads inside the open conversation, and where General is.
   *
   * The Requests that have been talked about, the conversation's own first
   * when it is anchored to one — which is the case for a conversation that
   * has never been about anything else, and then `general` is null and the
   * strip offers to start it.
   */
  const inside = openRow
    ? [
        ...(openRow.requestId
          ? [{ id: openRow.id, label: openRow.requestTitle ?? "Request", unread: false }]
          : []),
        ...openRow.children.map((child) => ({
          id: child.id,
          label: child.requestTitle ?? "Request",
          unread: child.unread,
        })),
      ]
    : [];

  const general = openRow && !openRow.requestId ? openRow.id : null;

  /** Whether the open thread is this row, folded into it, or inside it. */
  const isOpen = (row: ThreadRow) =>
    Boolean(threadId) &&
    (row.id === threadId ||
      row.mergedIds.includes(threadId as string) ||
      row.children.some((child) => child.id === threadId));

  return (
    /*
     * `h-full`, not `100vh`.
     *
     * The shell draws a header above this and scrolls what is under it, so a
     * screen asking for the whole viewport asks for the header's height twice
     * and the page scrolls by exactly that much — the list sliding up under
     * the search bar while the conversation beside it stayed put. This screen
     * fills what it is given; the two columns inside it scroll on their own.
     */
    <div className="flex h-full min-h-0 p-3">
      {/* Someone else sending something updates this screen where it stands. */}
      <LiveMessages />

      {/*
       * Its own ground, and only here — see `.pa-chat-pane` in globals for
       * what it carries. Set into the page rather than run to its edges,
       * because the rail to its left and the bar above it are white: a slab
       * butted against both reads as a piece cut out of the screen. With a
       * margin of the page's own ground around it and its corners turned, it
       * reads as a panel sitting on the page, which is what it is.
       */}
      <div
        className="pa-chat-pane flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[16px]"
        style={{
          boxShadow:
            "0 1px 2px rgba(31,72,125,.1), 0 10px 28px -14px rgba(31,72,125,.22)",
        }}
      >
        {/* ── the list ─────────────────────────────────────────────── */}
        <div
          /* Wide enough for the four chips to sit on one line — at 288px
             Drafts wrapped onto a second row on its own.

             Below `lg` the two panes take turns instead of sitting side by
             side: 344px of rail on a 390px screen left 46px for the
             conversation, which is not a narrow conversation, it is none.
             The rail is the whole screen until a conversation is open, and
             then the conversation is. The same shape the client portal has
             had since it was built. */
          className={cn(
            "min-h-0 w-full flex-col border-line lg:flex lg:w-[344px] lg:shrink-0 lg:border-r",
            threadId ? "hidden" : "flex",
          )}
          /*
           * The panel, a shade above the conversation's ground.
           *
           * Two rails of one colour side by side with a hairline between them
           * read as a single band, which is what this was against the app's
           * navigation when both were light. The step between the list and the
           * conversation is what tells them apart now.
           */
          style={{ background: "var(--surface)" }}
        >
          <div className="px-4 pb-3.5 pt-5">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[20px] font-bold leading-none">Messages</h1>
                <p
                  className="mt-1.5 text-[11.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {counts.all === 0
                    ? "Nothing open"
                    : `${counts.all} open${counts.unread ? ` · ${counts.unread} unread` : ""}`}
                </p>
              </div>
              {/* One mark, on both tabs: it starts whatever the tab you are
                  on is made of. A full-width New Group button under the tabs
                  was a second control saying the same thing. */}
              <Link
                href={`${base}&new=1`}
                aria-label={tab === "group" ? "New group" : "New message"}
                title={tab === "group" ? "New group" : "New message"}
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center cursor-pointer rounded-[8px] bg-accent text-[18px] font-medium leading-none text-white no-underline transition-colors hover:bg-accent-hover hover:text-white"
              >
                +
              </Link>
            </div>

            <div className="mb-3">
              <ThreadSearch />
            </div>

            <div
              className="mb-3.5 flex rounded-[8px] p-0.5"
              style={{ background: "var(--chat-ground)" }}
            >
              {(["direct", "group"] as const).map((option) => (
                <Link
                  key={option}
                  href={`${LIST}?tab=${option}${inWorkspace}${onOneRequest}`}
                  className={cn(
                    "flex-1 rounded-[6px] py-1.5 text-center text-[12.5px] capitalize no-underline",
                    option === tab ? "font-semibold" : "font-medium",
                  )}
                  style={
                    option === tab
                      ? {
                          background: "var(--chat-field)",
                          color: "var(--ink)",
                          boxShadow: "0 1px 2px rgba(0,0,0,.35)",
                        }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    {option}
                    {/* Something said on the tab you are not looking at. */}
                    {result.ok && result.unreadByKind[option] > 0 && option !== tab ? (
                      <UnreadDot />
                    ) : null}
                  </span>
                </Link>
              ))}
            </div>

            {/*
             * Chips across the top, not a stack down the side.
             *
             * Four filters as full-width rows with their counts in the right
             * margin took a third of the rail to say what a row of pills says
             * in one line — and it is the shape everybody already reads in a
             * chat client. A count only where there is something to count:
             * "Drafts 0" is a number competing for attention with nothing
             * behind it.
             */}
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.filter((option) => option.value !== "archived").map((option) => {
                const active = option.value === filter;
                const count = result.ok ? counts[option.value] : 0;
                const href = `${LIST}?tab=${tab}${
                  option.value === "all" ? "" : `&filter=${option.value}`
                }${inWorkspace}${option.value === "request" ? onOneRequest : ""}${
                  query ? `&q=${encodeURIComponent(query)}` : ""
                }`;

                return (
                  <Link
                    key={option.value}
                    href={href}
                    className={cn(
                      "rounded-full border px-2.5 py-[5px] text-[12px] no-underline transition-colors",
                      active ? "font-semibold" : "font-medium",
                      !active && "hover:bg-[var(--surface-active)]",
                    )}
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--chrome-line)",
                      background: active ? "var(--accent-tint)" : "var(--surface)",
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    {option.label}
                    {count > 0 ? (
                      <span
                        className="ml-1 tabular-nums"
                        style={{
                          color:
                            option.value === "unread" && !active
                              ? "var(--danger-fg)"
                              : "inherit",
                          fontWeight: 700,
                        }}
                      >
                        {count}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>

            {/* Which one, asked only once By Request has been pressed — a
                permanent dropdown above the list was a filter nobody had
                asked for, sitting over the filters they had. */}
            {filter === "request" && requestOptions.length > 0 ? (
              <div className="mt-2.5">
                <RequestFilter value={requestFilter} options={requestOptions} />
              </div>
            ) : null}
          </div>

          {/*
           * Archived, on its own row above the conversations.
           *
           * Not a fifth chip: it is not a way of looking at this list, it is
           * the other list — which is exactly where a chat client puts it and
           * why nobody has to be told what it does.
           */}
          <Link
            href={`${LIST}?tab=${tab}${inWorkspace}${onOneRequest}${
              filter === "archived" ? "" : "&filter=archived"
            }`}
            className={cn(
              "flex items-center gap-3 border-t border-line px-4 py-3 no-underline transition-colors",
              filter !== "archived" && "hover:bg-[var(--surface-active)]",
            )}
            style={{
              background: filter === "archived" ? "var(--accent-tint)" : undefined,
              color: filter === "archived" ? "var(--accent)" : "var(--ink)",
            }}
          >
            <ArchiveGlyph />
            <span className="flex-1 text-[13.5px] font-medium">Archived</span>
            <span
              className="tabular-nums text-[12px] font-semibold"
              style={{
                color:
                  (result.ok ? counts.archived : 0) === 0
                    ? "var(--text-faint)"
                    : filter === "archived"
                      ? "var(--accent)"
                      : "var(--text-secondary)",
              }}
            >
              {result.ok ? counts.archived : 0}
            </span>
          </Link>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-auto border-t border-line",
              threads.length === 0 && "flex items-center justify-center px-5",
            )}
          >
            {threads.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 text-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-[14px] text-[18px]"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                  aria-hidden
                >
                  ✉
                </div>
                <div className="text-[13.5px] font-semibold">{empty.title}</div>
                <div
                  className="text-[12.5px] leading-[1.5]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {empty.detail}
                </div>
              </div>
            ) : (
              threads.map((row) => {
                /* Reading a Request thread is still reading this person. */
                const open = isOpen(row);
                const surface = open ? "var(--accent-tint-mid)" : "var(--surface)";
                const when = row.lastAt ? relativeTime(row.lastAt) : "";
                /* Only a conversation that is one thread has one subject
                   — see ThreadHeading. */
                const subject =
                  row.children.length > 0 || row.mergedIds.length > 1
                    ? null
                    : subjectLine(row);

                // 9.4 leads a group with the faces on it and its own name; a
                // direct row leads with the one person it is with.
                return (
                  <Link
                    key={row.id}
                    href={threadHref(opensAt(row))}
                    className={cn(
                      "block border-b border-line px-4 py-3.5 no-underline transition-colors",
                      !open && "hover:bg-[var(--surface-active)]",
                    )}
                    style={{
                      background: open ? "var(--accent-tint-mid)" : undefined,
                      color: "var(--ink)",
                    }}
                  >
                    {/*
                      * A group reads down the same column a direct row does.
                      *
                      * Its picture sat above the line it was talking about
                      * rather than beside it, so the name began one place and
                      * everything under it began another — two left edges in a
                      * 270px row, and neither list scanned like the other.
                      */}
                    {row.kind === "group" ? (
                      <div className="flex items-start gap-2.5">
                        {/* Its picture, or its own initials — never the
                            stacked faces of whoever happens to be in it,
                            which told two groups of the same people apart
                            not at all. */}
                        <span className="relative shrink-0">
                          <Face name={row.subject} photo={row.photo} />
                          {/* The number at the end of the row says this
                              already; two marks for one fact is one too many. */}
                          {row.unread && row.unreadCount === 0 ? (
                            <span className="absolute -right-px -top-px">
                              <UnreadDot ring={surface} />
                            </span>
                          ) : null}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="mb-[3px] flex items-center justify-between gap-3">
                            <span
                              className="min-w-0 truncate text-[13.5px]"
                              style={{ fontWeight: row.unread ? 600 : 500 }}
                            >
                              {row.subject}
                            </span>
                            <span
                              className="shrink-0 text-[11px]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {when}
                            </span>
                          </div>

                          {/* Name, then what was last said, then who is in it
                              — the same order a direct row reads in, so the
                              two lists scan alike. */}
                          <div
                            className="flex items-center gap-1 text-[12.5px]"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            <PreviewMark row={row} />
                            <span className="min-w-0 truncate">{row.preview}</span>
                            {row.unreadCount > 0 ? (
                              <UnreadCount count={row.unreadCount} />
                            ) : null}
                          </div>

                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className="rounded border border-line px-[7px] py-px text-[11px]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {row.participantCount} members
                            </span>
                            {row.archived ? <ArchivedChip /> : null}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5">
                        {/* The same red the bell counts. Unread was carried by
                            weight alone, which on a list of two is a difference
                            nobody sees and on a list of forty is none at all. */}
                        <span className="relative shrink-0">
                          <Face name={row.counterparty} photo={row.counterpartyPhoto} />
                          {/* The number at the end of the row says this
                              already; two marks for one fact is one too many. */}
                          {row.unread && row.unreadCount === 0 ? (
                            <span className="absolute -right-px -top-px">
                              <UnreadDot ring={surface} />
                            </span>
                          ) : null}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="mb-[3px] flex items-center justify-between gap-3">
                            <span
                              className="min-w-0 truncate text-[13.5px]"
                              style={{ fontWeight: row.unread ? 600 : 500 }}
                            >
                              {row.counterparty}
                            </span>
                            <span
                              className="shrink-0 text-[11px]"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              {when}
                            </span>
                          </div>

                          {subject ? (
                            <div
                              className="mb-0.5 truncate text-[13px]"
                              style={{ fontWeight: row.unread ? 600 : 400 }}
                            >
                              {subject}
                            </div>
                          ) : null}

                          <div
                            className="flex items-center gap-1 text-[12.5px]"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            <PreviewMark row={row} />
                            <span className="min-w-0 truncate">{row.preview}</span>
                            {row.unreadCount > 0 ? (
                              <UnreadCount count={row.unreadCount} />
                            ) : null}
                          </div>

                          {/*
                           * The Requests are not named here any more.
                           *
                           * A row carried up to three of them under the last
                           * thing said, which is a filing cabinet where a chat
                           * list should be — the client asked for the plain
                           * thing WhatsApp does. They are named inside the
                           * conversation, on the strip, which is where you are
                           * when the answer matters.
                           */}
                          {row.archived ? (
                            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <ArchivedChip />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* ── the conversation ─────────────────────────────────────── */}
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col lg:flex",
            threadId ? "flex" : "hidden",
          )}
          style={{ background: "var(--chat-ground)" }}
        >
          {!result.ok ? (
            <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-10">
              <StateMessage
                glyph="!"
                tone="danger"
                title="Something went wrong"
                description="We couldn't load your Messages. Check your connection and try again, if this keeps happening, contact support."
                action={
                  <>
                    <Button unsized
                      href="mailto:support@privateattache.com"
                      variant="secondary"
                      className="px-4 py-[9px]"
                    >
                      Contact support
                    </Button>
                    <Button unsized href={LIST} variant="primary" className="px-[18px] py-[9px] text-[14px]">
                      Try again
                    </Button>
                  </>
                }
              />
            </div>
          ) : !thread ? (
            /*
             * The two thirds of this screen nobody is using yet.
             *
             * It was one grey line in the middle of a white field, which tells
             * somebody arriving here neither what this screen is nor what to do
             * on it. A mark, a sentence and the one action, which is the same
             * action as the + above the list.
             */
            <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
              {/* Two bubbles rather than an envelope: this is not mail, and a
                  drawn mark at this size reads where a glyph does not. */}
              <span
                aria-hidden
                className="mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-full"
                style={{
                  background: "var(--accent-tint)",
                  boxShadow: "0 0 0 8px rgba(31,72,125,.04)",
                }}
              >
                <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden>
                  <path
                    d="M4.5 12.2c0-2.4 1.9-4.4 4.3-4.4h9.4c2.4 0 4.3 2 4.3 4.4v4.3c0 2.4-1.9 4.4-4.3 4.4h-5.3l-4.6 3.4a.7.7 0 0 1-1.1-.6v-2.9a4.4 4.4 0 0 1-2.7-4.1v-4.5Z"
                    fill="var(--accent)"
                    fillOpacity=".16"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M24.8 11.4a4.4 4.4 0 0 1 2.7 4v4.2a4.4 4.4 0 0 1-2.6 4v2.7a.7.7 0 0 1-1.1.6l-3.4-2.5"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>

              <p
                className="text-[18px] font-bold tracking-[-0.2px]"
                style={{ color: "var(--chat-ink)", margin: 0 }}
              >
                {threads.length === 0
                  ? tab === "group"
                    ? "No groups yet"
                    : "No conversations yet"
                  : "Pick a conversation"}
              </p>

              <p
                className="mt-2 max-w-[380px] text-[13.5px] leading-[1.6]"
                style={{ color: "var(--chat-muted)", margin: "8px 0 0" }}
              >
                {threads.length === 0
                  ? "Everything said to a client or a provider about a piece of work lives here, beside the Request it belongs to."
                  : "Choose one from the list to read it, or start a new one."}
              </p>

              <Link
                href={`${base}&new=1`}
                className="mt-6 flex items-center gap-1.5 rounded-control px-[18px] py-[10px] text-[13.5px] font-semibold no-underline transition-colors hover:bg-[var(--accent-hover)]"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  boxShadow: "0 6px 18px -8px rgba(31,72,125,.55)",
                }}
              >
                <span className="text-[15px] leading-none">+</span>
                {tab === "group" ? "New group" : "New conversation"}
              </Link>

            </div>
          ) : (
            <>
              <div
                className="flex items-center justify-between gap-4 border-b border-line px-7 py-4"
                style={{ background: "var(--chat-head)" }}
              >
                <ThreadHeading
                  thread={thread}
                  photo={openRow?.photo ?? thread.photo}
                  folded={Boolean(
                    openRow && (openRow.children.length > 0 || openRow.mergedIds.length > 1),
                  )}
                />

                <div className="flex shrink-0 items-center gap-2">
                  {/* Beside the menu, over the conversation it searches. */}
                  <ConversationSearch />

                  {thread.archived ? (
                    <span
                      className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                      style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
                    >
                      Archived
                    </span>
                  ) : null}

                  {/* Everything a conversation can have done to it, behind one
                      mark — see ThreadMenu. */}
                  <ThreadMenu
                    label={thread.kind === "group" ? "Group menu" : "Conversation menu"}
                    items={[
                      {
                        label: thread.kind === "group" ? "Group settings" : "Conversation settings",
                        href: `${threadHref(thread.id)}&settings=1`,
                        detail:
                          thread.kind === "group"
                            ? "Name, picture, people, and the Request"
                            : "The Request it is filed under",
                      },
                      { label: "Create a task", href: `${threadHref(thread.id)}&task=1` },
                      {
                        label: thread.archived ? "Bring back from Archived" : "Archive conversation",
                        href: `${threadHref(thread.id)}&archive=1`,
                      },
                      ...(thread.kind === "group" && thread.canDelete
                        ? [
                            {
                              label: "Delete group",
                              href: `${threadHref(thread.id)}&remove=1`,
                              danger: true,
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>

              {/*
               * The work talked about inside this conversation, along its top.
               *
               * A person is one chat — so what was said about each Request is
               * a thread within it rather than another row in the rail wearing
               * the same face. This is how you move between them, and the
               * first pill is the talk that belongs to no Request.
               */}
              {openRow && inside.length > 0 ? (
                <div
                  className="pa-no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-line px-7 py-[9px]"
                  style={{ background: "var(--chat-head)" }}
                >
                  {/*
                   * General first, whether or not it exists yet.
                   *
                   * A conversation that began on a Request has no thread for
                   * anything else — so the pill asks for one, and the thread
                   * is written the moment it is asked for rather than sitting
                   * empty in everybody's rail beforehand.
                   */}
                  {general ? (
                    <ThreadPill
                      href={threadHref(general)}
                      label="General"
                      active={openRow.mergedIds.includes(thread.id)}
                      unread={false}
                    />
                  ) : (
                    <form action={openGeneralThread}>
                      <input type="hidden" name="thread_id" value={openRow.id} />
                      <SubmitPlain
                        className="flex shrink-0 items-center rounded-full px-[11px] py-[5px] text-[12.5px] transition-colors hover:bg-[var(--surface-active)]"
                        style={{ color: "var(--text-secondary)", fontWeight: 450 }}
                      >
                        General
                      </SubmitPlain>
                    </form>
                  )}

                  {inside.map((one) => (
                    <ThreadPill
                      key={one.id}
                      href={threadHref(one.id)}
                      label={one.label}
                      active={one.id === thread.id}
                      unread={one.unread}
                    />
                  ))}
                </div>
              ) : null}

              {/* Archived is read, not closed — but a conversation you are
                  typing into should say where it is filed. */}
              {thread.archived ? (
                <div
                  className="flex items-center justify-between gap-3 border-b border-line px-7 py-2.5 text-[12.5px]"
                  style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
                >
                  <span>
                    This conversation is archived. Replying brings it back to the list.
                  </span>
                  <Link
                    href={`${threadHref(thread.id)}&archive=1`}
                    className="shrink-0 font-medium no-underline"
                    style={{ color: "var(--accent)" }}
                  >
                    Bring it back
                  </Link>
                </div>
              ) : null}

              <Conversation
                threadId={thread.id}
                threadKind={thread.kind}
                messages={thread.messages}
                myName={myName}
                myPhoto={myPhoto}
                draft={thread.draft?.body ?? ""}
                draftId={thread.draft?.id ?? null}
                find={find}
                error={error}
                othersReadAt={thread.othersReadAt}
                readers={thread.readers}
              />

              {/* Opening a thread is reading it — which is the whole of the read
                  state. Bold until looked at, then not. All of what was read:
                  a conversation folded from several threads is read from all
                  of them, so leaving one of them bold would be a lie. */}
              <MarkRead threadId={thread.id} also={thread.mergedIds} />
            </>
          )}
        </div>
      </div>

      {creating ? (
        tab === "group" ? (
          <NewThreadDialog
            requests={requestsHere}
            recipients={people}
            kind={tab}
            scopeName={clientName ?? null}
            closeHref={base}
            error={error}
          />
        ) : (
          <NewDirectDialog
            recipients={people}
            requests={requestsHere}
            scopeName={clientName ?? null}
            closeHref={base}
            error={error}
          />
        )
      ) : null}

      {linking && thread ? (
        <AddToRequestDialog
          threadId={thread.id}
          subject={thread.subject}
          requests={requestsHere}
          current={thread.requestId}
          currentTitle={thread.requestTitle}
          newHref={`${base}&new=1`}
          direct={thread.kind === "direct"}
          closeHref={threadHref(thread.id)}
        />
      ) : null}

      {makingTask && thread ? (
        <NewTaskDialog
          requests={requests}
          clients={clients.filter((row) => !client || row.id === client)}
          streams={streams}
          assignees={assignees}
          currentUserId={profile?.user.id}
          openClientId={client || null}
          /* And the work it is about: a task made from a conversation filed
             under a Request belongs to that Request. */
          openRequestId={thread.requestId}
          closeHref={threadHref(thread.id)}
          error={error}
        />
      ) : null}

      {addingPerson && thread && thread.kind === "group" ? (
        <AddParticipantDialog
          threadId={thread.id}
          people={people}
          alreadyOn={thread.people.map((person) => person.id)}
          alreadyKinds={thread.people.map((person) => person.kind)}
          closeHref={threadHref(thread.id)}
          error={error}
        />
      ) : null}

      {settings && thread ? (
        <ConversationSettingsDialog
          thread={{
            id: thread.id,
            subject: thread.subject,
            kind: thread.kind,
            requestTitle: thread.requestTitle,
            archived: thread.archived,
            photo: openRow?.photo ?? thread.photo,
            canDelete: thread.canDelete,
          }}
          people={thread.people}
          recipients={people}
          linkHref={`${threadHref(thread.id)}&link=1`}
          archiveHref={`${threadHref(thread.id)}&archive=1`}
          deleteHref={`${threadHref(thread.id)}&remove=1`}
          closeHref={threadHref(thread.id)}
          error={error}
        />
      ) : null}

      {archiving && thread ? (
        <ArchiveConversationDialog
          threadId={thread.id}
          subject={thread.kind === "group" ? thread.subject : thread.counterparty}
          archived={thread.archived}
          closeHref={threadHref(thread.id)}
        />
      ) : null}

      {deleting && thread && thread.kind === "group" && thread.canDelete ? (
        <DeleteGroupDialog
          threadId={thread.id}
          subject={thread.subject}
          messageCount={thread.messages.length}
          peopleCount={thread.participantCount}
          closeHref={threadHref(thread.id)}
        />
      ) : null}

      {saved ? (
        <Toast
          title={
            saved === "picture"
              ? "Picture saved"
              : saved === "both"
                ? "Saved"
                : "Name saved"
          }
          detail={
            saved === "picture"
              ? "It shows on the conversation and in the list."
              : saved === "both"
                ? "The name and the picture are up to date."
                : "The conversation goes by that now."
          }
          closeHref={threadId ? threadHref(threadId) : base}
        />
      ) : null}

      {put ? (
        <Toast
          title="Conversation archived"
          detail="It is in Archived, and comes back the moment somebody replies."
          closeHref={`${LIST}?tab=${tab}&filter=archived`}
        />
      ) : null}

      {restored ? (
        <Toast
          title="Back in the list"
          detail="The conversation is out of Archived."
          closeHref={threadId ? threadHref(threadId) : base}
        />
      ) : null}

      {deleted ? (
        <Toast
          title="Group deleted"
          detail="The group and everything said in it are gone."
          closeHref={base}
        />
      ) : null}

      {taskMade ? (
        <Toast
          title="Task created"
          detail={`"${taskMade}" was added from this conversation.`}
          closeHref={threadId ? threadHref(threadId) : base}
        />
      ) : null}

      {linked ? (
        <Toast
          title="Added to Request"
          detail="The conversation now shows on that Request as well."
          closeHref={threadId ? threadHref(threadId) : base}
        />
      ) : null}

      {/* A conversation that was already there is not one you just started. */}
      {opened && thread ? (
        <Toast
          title={opened === "new" ? "Conversation started" : "Here it is"}
          detail={
            opened === "new"
              ? `Your first conversation with ${thread.counterparty} ${
                  thread.requestTitle ? `about ${thread.requestTitle}` : "about nothing in particular"
                }.`
              : `Your conversation with ${thread.counterparty} ${
                  thread.requestTitle ? `about ${thread.requestTitle}` : "about nothing in particular"
                }.`
          }
          closeHref={threadHref(thread.id)}
        />
      ) : null}
    </div>
  );
}
