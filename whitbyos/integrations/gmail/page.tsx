import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { Button } from "@/base/components/Button";
import { BackLink } from "@/whitbyos/components/BackLink";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { FilterBar } from "@/whitbyos/components/FilterBar";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import {
  listGmailBySource,
  listGmailSourceOptions,
  type GmailPersonSection,
  type GmailThreadRow,
} from "@/whitbyos/lib/gmail-context";
import { relativeTime } from "@/whitbyos/lib/format";
import { param, type SearchParams } from "@/whitbyos/lib/params";

const INTEGRATIONS = "/whitbyos/integrations";
const HERE = "/whitbyos/integrations/gmail";

/** What each kind of named person is, in a word beside their name. */
const KIND_LABEL: Record<string, string> = {
  client: "Client",
  contact: "Client contact",
  team: "Your team",
  external: "External",
};

/**
 * Everything a connected Gmail has brought in, under the people it is with.
 *
 * Reached from the Gmail row on Integrations, which is where the same people
 * were named in the first place — 16.2 chooses who may be read, and this is
 * what they have written since.
 *
 * Filed by person rather than as one feed by date. The professional allowed
 * specific people, so the question this page answers is "what has come from
 * each of them", and a date-ordered list of everything would answer a question
 * nobody asked. Picking one person narrows it to that correspondence.
 *
 * Only `relevant` rows. A message read and found empty is kept so the next sync
 * does not pay to read it again, and it is not correspondence to show anybody.
 */
export default async function GmailContextPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return (
      <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
        <BackLink href={INTEGRATIONS} label="Integrations" />
        <StateMessage glyph="✉" title="No workspace is open" description="Choose a workspace to see what Gmail has brought in." />
      </div>
    );
  }

  const person = param(searchParams, "person");
  const search = param(searchParams, "q");

  const [sections, people] = await Promise.all([
    listGmailBySource(workspaceId, person, search),
    listGmailSourceOptions(workspaceId),
  ]);

  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const narrowed = Boolean(person || search);

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href={INTEGRATIONS} label="Integrations" />

      <PageHeader
        title="Email from Gmail"
        size={22}
        subtitle="What Whitby has read to and from the people you named, and what it took from each message."
      />

      {people.length > 0 ? (
        <FilterBar
          action={HERE}
          searchPlaceholder="Search subjects and summaries…"
          searchValue={search}
          selects={[
            {
              name: "person",
              anyLabel: "All people",
              value: person,
              options: people.map((row) => ({ value: row.id, label: row.label })),
            },
          ]}
        />
      ) : null}

      {people.length === 0 ? (
        <StateMessage
          glyph="✉"
          title="Nobody is named yet"
          description="Whitby reads mail only from people you allow. Choose them from the Gmail row on Integrations, and what they write will appear here."
          action={
            <Button href={`${INTEGRATIONS}?manage=gmail`} variant="primary">
              Choose who Whitby may read
            </Button>
          }
        />
      ) : total === 0 ? (
        <StateMessage
          glyph="✉"
          title={narrowed ? "Nothing matches that" : "Nothing has come in yet"}
          description={
            narrowed
              ? "Try a different search, or clear the filters to see every message."
              : "Whitby syncs the mailbox while you work and once a day besides. Mail from the people you named will appear here as it arrives."
          }
          action={
            narrowed ? (
              <Button href={HERE} variant="secondary">
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-7">
          {sections.map((section) => (
            <PersonSection key={section.sourceId} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One named person, and everything read to or from them. */
function PersonSection({ section }: { section: GmailPersonSection }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          {section.name}
        </h2>
        <Pill tone="neutral">{KIND_LABEL[section.kind] ?? section.kind}</Pill>
        <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {section.email}
        </span>
        <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          · {section.rows.length} message{section.rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-hidden rounded-[8px] border border-line">
        {section.rows.map((row) => (
          <MessageRow key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

/**
 * One message, as much of it as exists.
 *
 * The body is nowhere — migration 060 keeps the summary and the facts Whitby
 * pulled out and throws the message away — so this prints what was kept rather
 * than pretending to be a mail client.
 */
function MessageRow({ row }: { row: GmailThreadRow }) {
  const href = row.requestId
    ? `/whitbyos/requests/${row.requestId}`
    : row.clientId
      ? `/whitbyos/clients/${row.clientId}`
      : null;

  return (
    <div className="flex flex-col gap-2 border-b border-line p-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={row.direction === "outgoing" ? "neutral" : "info"}>
          {row.direction === "outgoing" ? "Sent" : "Received"}
        </Pill>
        <span className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
          {row.subject || "No subject"}
        </span>
        <span className="ml-auto text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {relativeTime(row.at)}
        </span>
      </div>

      {row.summary ? (
        <p
          className="text-[13px] leading-[1.55]"
          style={{ margin: 0, color: "var(--text-secondary)" }}
        >
          {row.summary}
        </p>
      ) : null}

      {row.facts.length > 0 ? (
        <ul className="flex flex-col gap-1" style={{ margin: 0, paddingLeft: 18 }}>
          {row.facts.map((fact, index) => (
            <li key={index} className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
              {fact}
            </li>
          ))}
        </ul>
      ) : null}

      {href ? (
        <Link href={href} className="text-[12.5px] no-underline" style={{ color: "var(--accent)" }}>
          Open the work this is filed against →
        </Link>
      ) : null}
    </div>
  );
}
