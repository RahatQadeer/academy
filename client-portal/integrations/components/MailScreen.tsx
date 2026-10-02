import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { initialsFrom } from "@/base/components/Avatar";
import { listIntegrations, loadEmail } from "@/client-portal/lib/data/integrations";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { relativeTime } from "@/client-portal/lib/format";
import { param, type ScreenProps } from "@/client-portal/lib/routing";
import { SOURCE_KIND_LABEL } from "@/client-portal/lib/integrations/catalog";
import type { EmailPerson, EmailRow, MailProvider } from "@/client-portal/lib/integrations/mail";
import { PageBody, PageIntro } from "@/client-portal/components/PageHeader";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { EmptyState } from "@/client-portal/components/States";
import { SyncNow } from "./SyncNow";

const LIST = "/client-portal/integrations";

/** Sync now and Choose people are a pair, so they carry one size between them. */
const ACTION_SIZE = "px-3.5 py-[7px] text-[13px]";

/**
 * One mailbox's summaries — Whitby's "Email from Gmail" page, for the client's
 * own mailbox, whichever of the two it is.
 *
 * Filed under the people chosen on Manage, because that is how the reading was
 * allowed in the first place: this is the same list, with what each person and
 * the client have written to each other beneath it. Only messages the reading
 * judged worth knowing about are shown; the rest were read so they would not be
 * read twice, and are nothing to look at.
 *
 * The body of a message is nowhere — only its summary and the facts in it — so
 * this reads as notes about correspondence, not as a mail client.
 *
 * GMAIL AND OUTLOOK MAIL ARE THIS ONE SCREEN, TWICE
 *
 * They are the same screen because they are the same reading — client-portal/021
 * keys the rows on the provider and `mail.ts` does the work for both. The two
 * routes stay separate so a client with both mailboxes can tell which summary
 * came from where without a mark on every card, and so either can be opened
 * from its own row on Integrations.
 */
export async function MailScreen({
  provider,
  here,
  searchParams,
}: ScreenProps & { provider: MailProvider; here: string }) {
  const HERE = here;
  const person = param(searchParams, "person") ?? null;
  const search = (param(searchParams, "q") ?? "").trim();

  const [context, integrations, email] = await Promise.all([
    getPortalContext(),
    listIntegrations(),
    loadEmail(provider, person, search),
  ]);

  const mailbox = integrations.find((row) => row.key === provider);
  const connected = mailbox?.status !== "disconnected";
  const narrowed = Boolean(person || search);
  const total = email.sections.reduce((sum, section) => sum + section.rows.length, 0);

  /*
   * An empty screen has three quite different causes and used to have one
   * sentence for all of them.
   *
   * Only messages the reading judged worth knowing about are drawn, so a
   * mailbox that was read perfectly well and contained nothing urgent looked
   * exactly like one that was never read — and, with a person chip active,
   * blamed the filter for it ("try another word"), which was the one thing
   * that was never the reason. `routine` is how many messages with these
   * people were read and set aside, so the screen can tell the client which of
   * the three they are looking at.
   */
  const routine = email.routine;
  const messages = routine === 1 ? "message" : "messages";

  const emptyTitle = search
    ? "Nothing matches that"
    : routine > 0
      ? "Nothing needs you right now"
      : "Nothing worth noting yet";

  const emptyBody = search
    ? "Try another word, or clear the search to see everything."
    : routine > 0
      ? `${routine} ${messages} with ${person ? "this person" : "the people you chose"} ${routine === 1 ? "was" : "were"} read in the last 30 days, and none of them needed you to know or do anything. Anything that does will be summarised here.`
      : "Mail from the last 30 days with the people you chose is read as it arrives. Anything that needs your attention will be summarised here.";

  const hrefFor = (next: { person?: string | null; q?: string }) => {
    const query = new URLSearchParams();
    if (next.person) query.set("person", next.person);
    if (next.q) query.set("q", next.q);
    const rest = query.toString();
    return rest ? `${HERE}?${rest}` : HERE;
  };

  return (
    <PageBody>
      <div className="max-w-[920px]">
        {/* Titled "Email" on the bar, with the arrow back to Integrations
            beside it. */}
        <PageIntro
          note={
            mailbox?.connectedAccount
              ? `Summaries of the mail ${mailbox.connectedAccount} exchanges with the people you chose.`
              : "Summaries of the mail you exchange with the people you chose."
          }
          action={
            connected ? (
              <div className="flex flex-wrap items-center gap-2">
                <SyncNow provider={provider} back={hrefFor({ person, q: search })} sizing={ACTION_SIZE} />
                <Link
                  href={`${LIST}?manage=${provider}`}
                  className={`inline-flex items-center rounded-control border border-line-strong font-medium no-underline transition-colors hover:bg-surface-soft ${ACTION_SIZE}`}
                  style={{ color: "var(--ink)" }}
                >
                  Choose people
                </Link>
              </div>
            ) : null
          }
        />

        <DataNotice context={context} />

        {!connected ? (
          <EmptyState
            glyph="✉"
            title={`${mailbox?.name ?? "This mailbox"} isn't connected`}
            body={`Connect ${mailbox?.name ?? "it"} on Integrations and choose whose mail may be read. Summaries appear here, private to you.`}
            actionLabel="Go to Integrations"
            actionHref={LIST}
          />
        ) : email.people.length === 0 ? (
          <EmptyState
            glyph="✉"
            title="Nobody is chosen yet"
            body="Nothing in your mailbox is read until you choose people. Pick the ones whose email you'd like summarised."
            actionLabel="Choose people"
            actionHref={`${LIST}?manage=${provider}`}
          />
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
              <nav aria-label="People" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                <FilterChip href={hrefFor({ q: search })} active={!person}>
                  Everyone
                </FilterChip>
                {email.people.map((one) => (
                  <FilterChip
                    key={one.id}
                    href={hrefFor({ person: one.id, q: search })}
                    active={person === one.id}
                  >
                    {one.label}
                  </FilterChip>
                ))}
              </nav>

              <form action={HERE} method="get" className="lg:w-[260px]">
                {person ? <input type="hidden" name="person" value={person} /> : null}
                <input
                  type="search"
                  name="q"
                  defaultValue={search}
                  placeholder="Search subjects and summaries"
                  aria-label="Search email summaries"
                  className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-[13px] placeholder:text-[var(--text-quiet)]"
                />
              </form>
            </div>

            {total === 0 ? (
              <EmptyState
                glyph={search ? "⌕" : "✉"}
                title={emptyTitle}
                body={emptyBody}
                actionLabel={narrowed ? "Clear filters" : undefined}
                actionHref={narrowed ? HERE : undefined}
              />
            ) : (
              <div className="flex flex-col gap-8">
                {email.sections.map((section) => (
                  <PersonSection key={section.sourceId} section={section} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PageBody>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "max-w-[240px] truncate rounded-full border px-3 py-[5px] text-[12.5px] no-underline transition-colors",
        active ? "font-semibold" : "font-medium hover:bg-surface-soft",
      )}
      style={
        active
          ? { background: "var(--ink)", borderColor: "var(--ink)", color: "#fff" }
          : { borderColor: "var(--border-strong)", color: "var(--text-secondary)" }
      }
    >
      {children}
    </Link>
  );
}

function PersonSection({ section }: { section: EmailPerson }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
          style={
            section.kind === "team"
              ? { background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }
              : { background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }
          }
        >
          {section.kind === "external" ? "@" : initialsFrom(section.name)}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold">{section.name}</h2>
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {SOURCE_KIND_LABEL[section.kind]} · {section.rows.length} message
            {section.rows.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {section.rows.map((row) => (
          <MessageCard key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

function MessageCard({ row }: { row: EmailRow }) {
  const sent = row.direction === "outgoing";

  return (
    <article className="rounded-[8px] border bg-surface px-5 py-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2.5">
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[2px] text-[11.5px] font-medium"
          style={
            sent
              ? { background: "var(--canvas)", color: "var(--text-muted)" }
              : { background: "var(--accent-tint)", color: "var(--accent)" }
          }
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path
              d={sent ? "M2 8L8 2M8 2H3.5M8 2v4.5" : "M8 2L2 8M2 8h4.5M2 8V3.5"}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {sent ? "You sent" : "Received"}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{row.subject || "No subject"}</h3>
        {row.at ? (
          <time
            dateTime={row.at}
            className="shrink-0 text-[12px]"
            style={{ color: "var(--text-tertiary)" }}
            suppressHydrationWarning
          >
            {relativeTime(row.at)}
          </time>
        ) : null}
      </div>

      {row.summary ? (
        <p className="mt-2 text-[13.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
          {row.summary}
        </p>
      ) : null}

      {row.facts.length > 0 ? (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {row.facts.map((fact, index) => (
            <li key={index} className="flex items-start gap-2 text-[13px] leading-[1.5]">
              <span
                aria-hidden
                className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
