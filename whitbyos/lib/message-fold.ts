import type { ThreadRow } from "./messages.ts";

/** Equal member rosters (order ignored). */
export function membersEqual(a: string[], b: string[]): boolean {
  return [...a].sort().join(",") === [...b].sort().join(",");
}

/** Equal, or one side is a subset of the other (add / remove drift). */
export function membersRelated(a: string[], b: string[]): boolean {
  if (membersEqual(a, b)) return true;
  if (a.length === 0 || b.length === 0) return false;
  const smaller = a.length <= b.length ? a : b;
  const larger = a.length <= b.length ? b : a;
  const hold = new Set(larger);
  return smaller.every((member) => hold.has(member));
}

export function personMemberKey(person: {
  participantType: string;
  id: string;
}): string {
  return `${person.participantType}:${person.id}`;
}

/** Whether a row is about a Request at all — its own, or one inside it. */
export function onRequest(row: ThreadRow) {
  return Boolean(row.requestId) || row.children.length > 0;
}

/** Every Request a row can open, and which thread each one is. */
export function requestsOf(row: ThreadRow) {
  const all = [
    ...(row.requestId && row.requestTitle
      ? [{ id: row.requestId, title: row.requestTitle, threadId: row.id }]
      : []),
    ...row.children
      .filter((child) => child.requestId && child.requestTitle)
      .map((child) => ({
        id: child.requestId as string,
        title: child.requestTitle as string,
        threadId: child.id,
      })),
  ];

  return [...new Map(all.map((item) => [item.id, item])).values()];
}

/** Newest first, on whatever each row last had to show for itself. */
function recent(a: ThreadRow, b: ThreadRow) {
  return String(b.lastAt ?? "").localeCompare(String(a.lastAt ?? ""));
}

/**
 * What makes two threads the same conversation.
 *
 * A direct thread is the person it is with. A group is its name — membership
 * drift (add / remove) is clustered later so siblings stay one chat. Archived
 * is part of it either way: a conversation put away is in Archived, and
 * pulling it into a live row would take it out of the only list that shows it.
 */
function conversationKey(row: ThreadRow) {
  const where = row.archived ? "away" : "open";

  if (row.kind === "direct") {
    /* Nobody to file it under, and no second thread it could be the same
       conversation as. */
    if (row.people.length !== 1) return null;

    const person = row.people[0];
    return `${where}:direct:${person.participantType}:${person.id}`;
  }

  return `${where}:group:${row.subject.trim().toLowerCase()}`;
}

/**
 * Within one group name, keep unrelated teams apart — same subject, different
 * people who never overlapped — while add/remove drift still folds together.
 */
function clusterGroupRows(rows: ThreadRow[]): ThreadRow[][] {
  const clusters: { members: string[]; rows: ThreadRow[] }[] = [];

  for (const row of rows) {
    const members = row.people.map(personMemberKey);
    const hit = clusters.find((cluster) => membersRelated(cluster.members, members));
    if (hit) {
      hit.rows.push(row);
      // Widen the cluster roster so further siblings can still match.
      const hold = new Set([...hit.members, ...members]);
      hit.members = [...hold];
      continue;
    }
    clusters.push({ members: [...members], rows: [row] });
  }

  return clusters.map((cluster) => cluster.rows);
}

/**
 * One conversation, with the work filed inside it.
 *
 * A thread was keyed on who it is with *and* the Request, so writing to
 * somebody about a second piece of work started a second conversation with
 * them: three rows for Rohail, the same face on each, and no way to read back
 * what he had actually said to you. The client asked for what a chat is —
 * one conversation per person, and one per group, with the work inside.
 *
 * So the rail folds them. General talk reads as a single stream however many
 * threads it is stored across; each Request that was written about becomes a
 * thread within that conversation, kept whole and still at its own address.
 * Nothing is merged in the database — a thread is exactly where it was, and
 * unfolding is a matter of not doing this.
 */
export function fold(rows: ThreadRow[]): ThreadRow[] {
  const alone: ThreadRow[] = [];
  const groups = new Map<string, ThreadRow[]>();

  for (const row of rows) {
    const key = conversationKey(row);

    if (!key) {
      if (!row.empty) alone.push(row);
      continue;
    }

    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  for (const [key, bucket] of groups) {
    const packs = key.includes(":group:") ? clusterGroupRows(bucket) : [bucket];

    for (const group of packs) {
      if (group.length === 1) {
        /*
         * A conversation with nothing in it is not a conversation — 9.0.
         *
         * An empty thread earns its place only as somewhere to talk generally
         * within a conversation that exists, which is the case below. On its
         * own it is a record of an intention: somebody opened New conversation
         * and closed it, or asked for the General thread of a group and said
         * nothing in it.
         */
        if (!group[0].empty) alone.push(group[0]);
        continue;
      }

      const byRecency = [...group].sort(recent);
      const generals = byRecency.filter((row) => !row.requestId);

      /*
       * The conversation itself is the talk that is filed under nothing — that
       * is what a reply typed in the person's own chat joins. Somebody only ever
       * written to about Requests has no such thread, and then the newest of
       * those stands as the conversation and the rest sit inside it.
       */
      const anchor = generals[0] ?? byRecency[0];
      const inside = byRecency.filter((row) => row.id !== anchor.id && row.requestId);

      /*
       * Roster from the newest activity — after a remove, that thread has the
       * current people and the "You removed …" line; an older sibling may still
       * list someone who left.
       */
      const roster = byRecency[0];

      /*
       * The row says what was last said here, wherever it was said — and an
       * empty General thread has nothing to say on anybody's behalf.
       *
       * Unless something is unsent. A draft is the one thing a chat list shows
       * in place of the last message, because it is the thing you left in the
       * middle: typed in General and then left, it was invisible behind a
       * Request thread that had been spoken in more recently, which is exactly
       * when somebody needs reminding of it.
       */
      const unsent = byRecency.find((row) => row.draft);
      const latest = unsent ?? byRecency.find((row) => !row.empty) ?? byRecency[0];

      const conversation: ThreadRow = {
        ...anchor,
        people: roster.people,
        participantCount: roster.participantCount,
        counterparty: roster.counterparty,
        empty: group.every((row) => row.empty),
        preview: latest.preview,
        lastAt: latest.lastAt,
        lastMine: latest.lastMine,
        lastRead: latest.lastRead,
        draft: Boolean(unsent),
        unread: group.some((row) => row.unread),
        unreadCount: group.reduce((sum, row) => sum + row.unreadCount, 0),
        /*
         * Opening the conversation opens what is waiting in it.
         *
         * Six unread on the Ontario permit and nothing in General, and landing
         * on General showed an empty screen with a six still on the row behind
         * it. A thread folded into the conversation needs no pointing at — it
         * is read as part of it — so only a Request thread moves where the row
         * opens.
         */
        openAt: (() => {
          const waiting = byRecency.find((row) => row.unread);
          if (!waiting) {
            /* Nothing waiting, but something of yours left unfinished: open
               where it is, which is where it can be finished. */
            const read = generals.length > 0 ? generals : [anchor];
            if (unsent && !read.some((row) => row.id === unsent.id)) return unsent.id;
            return anchor.id;
          }
          const read = generals.length > 0 ? generals : [anchor];
          return read.some((row) => row.id === waiting.id) ? anchor.id : waiting.id;
        })(),
        /* One group, one picture — it is stored per thread, and the thread
           anchoring the conversation is not always the one it was put on. */
        photo: anchor.photo ?? group.find((row) => row.photo)?.photo ?? null,
        clientId: anchor.clientId ?? group.find((row) => row.clientId)?.clientId ?? null,
        clientName: anchor.clientName ?? group.find((row) => row.clientName)?.clientName ?? null,
        mergedIds: (generals.length > 0 ? generals : [anchor]).map((row) => row.id),
        children: inside,
      };

      if (!conversation.empty) alone.push(conversation);
    }
  }

  return alone.sort(recent);
}

/** @internal — stable label for tests that inspect member keys. */
export function groupFoldKeyForTest(subject: string, members: string[]) {
  return `${subject.trim().toLowerCase()}:${[...members].sort().join(",")}`;
}
