/**
 * What it says under the last thing you sent.
 *
 * This used to be a tick, or two, or two in blue, on every bubble — a legend
 * nobody has been given. A chat says it in words, once, under the last message
 * you sent, and says when: "Seen 5m ago".
 *
 * Only the last one, because the rest are implied. If the newest message you
 * sent has been seen, so has everything under it.
 *
 * Pure, and tested, because the wording changes at six boundaries and a
 * relative time that is one unit out is worse than no time at all.
 */

export type Delivery = {
  /** Still in flight — drawn before the server has confirmed anything. */
  pending?: boolean;
  /** When it was sent. */
  at: string;
  /** When the other side's client recorded that it arrived, if it did. */
  deliveredAt: string | null;
  /** When everyone else last opened this thread, or null if nobody has. */
  readAt: string | null;
  /**
   * Who else is on the thread and when each of them last opened it.
   *
   * On a group, "Seen" with no name says one of four people looked, which is
   * the question rather than the answer. With the readers given, the label
   * names them — and says "everyone" once there is nobody left to name.
   *
   * Absent on a direct conversation, where `readAt` is the whole answer and
   * the one other person's name is already the heading.
   */
  readers?: Reader[];
};

export type Reader = { name: string; readAt: string | null };

/**
 * "Sending…", "Sent", "Delivered", or "Seen" and how long ago.
 *
 * Seen outranks delivered, because a message cannot be read without having
 * arrived — and a browser that was closed at the time may never have stamped
 * the arrival at all.
 */
export function deliveryLabel(message: Delivery, now: number): string {
  if (message.pending) return "Sending…";

  const sent = Date.parse(message.at);

  /* A group: who has seen it, by name, until everyone has. */
  if (message.readers && message.readers.length > 1) {
    const seen = message.readers.filter((person) => {
      const at = person.readAt ? Date.parse(person.readAt) : NaN;
      return !Number.isNaN(at) && !Number.isNaN(sent) && sent <= at;
    });

    if (seen.length === 0) return message.deliveredAt ? "Delivered" : "Sent";
    if (seen.length === message.readers.length) return "Seen by everyone";
    return `Seen by ${namesOf(seen.map((person) => person.name))}`;
  }

  const read = message.readAt ? Date.parse(message.readAt) : NaN;

  // Read the thread *since* this message: opening it an hour before you wrote
  // says nothing about whether they have seen what you wrote.
  if (!Number.isNaN(read) && !Number.isNaN(sent) && sent <= read) {
    return `Seen ${seenAgo(read, now)}`;
  }

  return message.deliveredAt ? "Delivered" : "Sent";
}

/**
 * "Hazel", "Hazel and Rohail", "Hazel, Rohail and 2 others".
 *
 * First names, because this line sits in an eleven-pixel margin under a
 * bubble: "Seen by Hazel Summers, Rohail Khan Ahmed" wraps onto two lines and
 * says nothing the first names did not.
 */
function namesOf(names: string[]): string {
  const first = names.map((name) => name.trim().split(/\s+/)[0] || name);

  if (first.length === 1) return first[0]!;
  if (first.length === 2) return `${first[0]} and ${first[1]}`;

  const rest = first.length - 2;
  return `${first[0]}, ${first[1]} and ${rest} ${rest === 1 ? "other" : "others"}`;
}

/**
 * How long ago, in the largest unit that still says something.
 *
 * Minutes for the first hour, because that is the question actually being
 * asked — did they look just now, or this morning. Then hours, then a day
 * named rather than counted, then days, then the date.
 */
export function seenAgo(readAt: number, now: number): string {
  // A clock a few seconds ahead of ours is not the future.
  const ms = Math.max(0, now - readAt);
  const minutes = Math.floor(ms / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "yesterday";

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const when = new Date(readAt);
  return `${when.getDate()} ${MONTHS[when.getMonth()]}`;
}

/**
 * Written out rather than formatted.
 *
 * `Intl` gives en-GB "Sept" and en-US "Sep" for the same month, and this runs
 * once on the server and again in the browser — two spellings of one date is a
 * hydration mismatch over a word nobody asked to have localised.
 */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
