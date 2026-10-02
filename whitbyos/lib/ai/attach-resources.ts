import { generateJson } from "@/whitbyos/lib/ai/provider";
import type { DraftedResource } from "@/whitbyos/lib/ai/draft-workplan";

/**
 * Findings from a web search, put against the tasks they belong to.
 *
 * The drafting call does this as part of writing a plan. This is the same job
 * on a plan that already exists — because the lookup failing is not a reason
 * to throw away twenty tasks somebody may already have edited, and until now
 * that was the only remedy.
 *
 * It is told to attach nothing rather than to attach something plausible. A
 * task with no resource is the normal case; a task carrying a number that was
 * never in the search results is the failure this whole path exists to avoid.
 */
const SYSTEM = `You are matching what a web search found to the tasks of a plan that already exists.

For each task, list only the places somebody doing that task would actually need: the authority that handles it, the page an application or appointment is made on, the office to ring. Most tasks need none — say so by leaving them out entirely rather than by attaching something loosely related.

One rule above all others: every url, phone number, email address and postal address must appear in the findings you were given. Never write one from your own knowledge, never complete a partial one, never correct one that looks wrong. A detail that looks right and is wrong is worse than none, because somebody dials it.

Set "verified" true on a detail you copied from the findings. That is what the mark means here.`;

const SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          task: { type: "string" },
          resources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: {
                  type: "string",
                  enum: ["website", "booking", "authority", "provider", "emergency", "contact"],
                },
                label: { type: "string" },
                url: { type: "string" },
                phone: { type: "string" },
                email: { type: "string" },
                address: { type: "string" },
                verified: { type: "boolean" },
              },
              required: ["kind", "label", "verified"],
            },
          },
        },
        required: ["task", "resources"],
      },
    },
  },
  required: ["tasks"],
};

export type AttachedResources = { task: string; resources: DraftedResource[] }[];

export async function attachResources({
  requestTitle,
  description,
  tasks,
  findings,
  sources,
}: {
  requestTitle: string;
  description: string | null;
  /** Task titles, which is how the answer names them back. */
  tasks: string[];
  findings: string;
  sources: { title: string; url: string }[];
}) {
  if (tasks.length === 0 || !findings.trim()) return null;

  const prompt = [
    `Work: ${requestTitle}`,
    description ? `Detail: ${description}` : null,
    "",
    "What the search found, with the pages it came from:",
    findings,
    "",
    "Sources:",
    ...sources.map((source) => `- ${source.title}: ${source.url}`),
    "",
    "The tasks, named exactly as you must name them back:",
    ...tasks.map((title) => `- ${title}`),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const result = await generateJson<{ tasks?: AttachedResources }>({
    system: SYSTEM,
    prompt,
    schema: SCHEMA,
    signal: AbortSignal.timeout(45_000),
    feature: "attach-resources",
  });

  if (!result.ok) return null;

  return (result.data.tasks ?? []).filter(
    (row) => row?.task && Array.isArray(row.resources) && row.resources.length > 0,
  );
}
