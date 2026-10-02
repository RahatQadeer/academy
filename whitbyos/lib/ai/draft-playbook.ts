import { generateJson, type AiResult } from "@/whitbyos/lib/ai/provider";
import type { PlaybookStream } from "@/whitbyos/lib/playbook-vocab";

/**
 * 6.0c's Ask Whitby — "Want help drafting Work Streams for this Playbook from
 * a description?", and on the duplicate and save-from-plan flows, "Want me to
 * merge, reorder, or trim any of these Work Streams before you save?"
 *
 * One function for both, because they are the same request seen from two
 * sides: with existing streams it is an edit, without them it is a first
 * draft. That is exactly how `draftWorkplan` treats a refinement, and the two
 * behave the same way for the same reason.
 *
 * A Playbook is a template, so nothing here carries a date, an owner or a
 * client. Those belong to the engagement a Playbook is used on, not to the
 * Playbook — which is the promise the reference makes when it says
 * client-specific details are stripped out.
 */

const SCHEMA = {
  type: "object",
  properties: {
    workStreams: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          purpose: { type: "string" },
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: { title: { type: "string" } },
              required: ["title"],
            },
          },
        },
        required: ["name", "tasks"],
      },
    },
  },
  required: ["workStreams"],
};

const SYSTEM = `You lay out reusable Work Stream templates for a family office.

A Playbook is a shape of work, not a piece of work. Write Work Streams and the
steps inside them the way they would read for any client of this kind, no
names, no dates, no amounts, no places. "Collect visa documentation", not
"Collect the Hartwells' visa documentation by 14 March".

Never name the software. A Playbook is read by the firm and ends up in what
their client is shown, so write what is done, not what any system does: "Confirm
the appointment", never "Whitby confirms the appointment".

Three to eight Work Streams. Two to six steps in each. Order them the way the
work actually runs, so that what has to happen first comes first.

Return JSON only.`;

export async function draftPlaybookStreams({
  name,
  category,
  description,
  current,
  instruction,
}: {
  name: string;
  category: string | null;
  description: string | null;
  /** What step 3 already holds, if anything — this is an edit when it does. */
  current?: PlaybookStream[];
  instruction: string;
}): Promise<AiResult<PlaybookStream[]>> {
  const context = [
    `Playbook: ${name}`,
    category ? `Category: ${category}` : null,
    description ? `What it is for: ${description}` : null,
    current?.length
      ? `\nIt currently lays out:\n${current
          .map(
            (stream, i) =>
              `${i + 1}. ${stream.name}\n` +
              stream.tasks.map((task) => `   - ${task.title}`).join("\n"),
          )
          .join("\n")}`
      : null,
    `\nThe professional asked: "${instruction}"`,
    current?.length
      ? "Apply exactly that change and return the whole Playbook. Keep every Work Stream and step they did not ask about as it was, in the same order and with the same wording."
      : "Draft the Work Streams and their steps.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateJson<{ workStreams: PlaybookStream[] }>({
    system: SYSTEM,
    prompt: context,
    schema: SCHEMA,
  });

  if (!result.ok) return result;

  const streams = (result.data.workStreams ?? [])
    .filter((stream) => typeof stream?.name === "string" && stream.name.trim())
    .map((stream) => ({
      name: stream.name.trim(),
      purpose: typeof stream.purpose === "string" ? stream.purpose.trim() : undefined,
      tasks: (stream.tasks ?? [])
        .filter((task) => typeof task?.title === "string" && task.title.trim())
        .map((task) => ({ title: task.title.trim() })),
    }));

  if (streams.length === 0) {
    return { ok: false, error: "Whitby did not return any Work Streams. Try describing it another way." };
  }

  return { ok: true, data: streams };
}
