"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { unbranded } from "@/whitbyos/lib/unbranded";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { readStreams } from "@/whitbyos/lib/playbook-vocab";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";

const LIST = "/whitbyos/playbooks";
const ROUTE = "/[product]/[[...slug]]";

function backWithError(message: string): never {
  redirect(`${LIST}?new=1&error=${encodeURIComponent(message)}`);
}

export async function duplicatePlaybook(formData: FormData) {
  await stopIfReadOnly();

  const playbookId = String(formData.get("playbook_id") ?? "").trim();
  if (!playbookId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { data: source } = await supabase
    .from("whitbyos_playbooks")
    .select("name, category, contents, shared_level, workspace_id")
    .eq("id", playbookId)
    .maybeSingle();

  if (!source || source.workspace_id !== workspaceId) redirect(LIST);

  const { data, error } = await supabase
    .from("whitbyos_playbooks")
    .insert({
      workspace_id: workspaceId,
      name: `${source.name} (copy)`,
      category: source.category,
      contents: source.contents,
      version: 1,
      // A copy starts private whatever the original was. Sharing is a decision
      // about a particular playbook, not something a duplicate inherits.
      shared_level: "private",
      // And it belongs to whoever made the copy, for the same reason.
      created_by_user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) redirect(`${LIST}/${playbookId}?error=${encodeURIComponent(error?.message ?? "Could not duplicate it.")}`);

  await recordVersion({
    playbookId: data.id as string,
    version: 1,
    contents: source.contents,
    reason: "Created",
  });

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}/${data.id}?duplicated=1`);
}

/** 6.1's Edit — name, category, description, sharing, and the streams. */
export async function updatePlaybook(formData: FormData) {
  await stopIfReadOnly();

  const playbookId = String(formData.get("playbook_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const shared = String(formData.get("shared_level") ?? "private").trim();

  const back = `${LIST}/${playbookId}`;
  if (!playbookId) redirect(LIST);
  if (!name) redirect(`${back}?edit=1&error=${encodeURIComponent("A playbook needs a name.")}`);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("whitbyos_playbooks")
    .select("contents, version, workspace_id")
    .eq("id", playbookId)
    .maybeSingle();

  if (!current || current.workspace_id !== workspaceId) redirect(LIST);

  const typed = String(formData.get("streams") ?? "").trim();
  const streams = typed
    ? typed
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          // Keep the tasks a stream already had when its name is unchanged —
          // editing the list should not quietly empty every stream in it.
          const existing = readStreams(current.contents).find((row) => row.name === line);
          return existing ?? { name: line, tasks: [] };
        })
    : readStreams(current.contents);

  const { error } = await supabase
    .from("whitbyos_playbooks")
    .update({
      name,
      category: category || null,
      contents: { description: description || null, streams },
      // §6.10 versions a Playbook rather than overwriting it silently.
      version: ((current.version as number) ?? 1) + 1,
      shared_level: ["private", "team", "organization"].includes(shared) ? shared : "private",
      updated_at: new Date().toISOString(),
    })
    .eq("id", playbookId);

  if (error) redirect(`${back}?edit=1&error=${encodeURIComponent(error.message)}`);

  await recordVersion({
    playbookId,
    version: ((current.version as number) ?? 1) + 1,
    contents: { description: description || null, streams },
    reason: "Edited",
  });

  revalidatePath(ROUTE, "page");
  redirect(`${back}?saved=1`);
}

/**
 * 6.1's Version History, written as it happens.
 *
 * Never throws and never blocks the edit it describes: the history is a record
 * of what was done, and failing to write the record is not a reason to undo
 * the doing. A missing entry shows as a gap in the panel, which is honest.
 */
async function recordVersion({
  playbookId,
  version,
  contents,
  reason,
}: {
  playbookId: string;
  version: number;
  contents: unknown;
  reason: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("whitbyos_playbook_versions").insert({
    playbook_id: playbookId,
    version_number: version,
    snapshot: contents,
    change_reason: reason,
    created_by_user_id: user?.id ?? null,
  });
}

/**
 * 6.3 — archiving a Playbook, or removing it from every screen.
 *
 * The same settlement Work Plans reached in WP.2c, because the client's rule
 * did not change between the two: nothing leaves the database. "Archive" files
 * it out of the library and Settings → Archive brings it back; "Delete
 * permanently" takes it off every screen and does not.
 *
 * Neither goes anywhere near a Work Plan built from this Playbook. Those hold
 * their own copy of the content, and `source_playbook_id` records where they
 * came from rather than depending on it — which is what lets the dialog promise
 * they are unaffected and be telling the truth. The one visible consequence is
 * that the Playbook's "Times Used" no longer has a library entry to sit on.
 */
export async function archivePlaybook(formData: FormData) {
  await stopIfReadOnly();

  const playbookId = String(formData.get("playbook_id") ?? "").trim();
  const scope = String(formData.get("scope") ?? "archive").trim();
  if (!playbookId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LIST);

  const { data: playbook } = await supabase
    .from("whitbyos_playbooks")
    .select("id, name, created_by_user_id, workspace_id")
    .eq("id", playbookId)
    .maybeSingle();

  if (!playbook || playbook.workspace_id !== workspaceId) redirect(LIST);

  // Only whoever made it. A Playbook shared with the organization is on every
  // colleague's list, and removing it from all of them is not something to be
  // able to do to somebody else's work on the way past.
  const author = playbook.created_by_user_id as string | null;
  if (author && author !== user.id) {
    redirect(
      `${LIST}?error=${encodeURIComponent("Only whoever created this Playbook can archive or delete it.")}`,
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("whitbyos_playbooks")
    .update(
      scope === "delete"
        ? { deleted_at: now, deleted_by_user_id: user.id, updated_at: now }
        : { archived_at: now, archived_by_user_id: user.id, updated_at: now },
    )
    .eq("id", playbookId);

  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?${scope === "delete" ? "deleted" : "archived"}=1`);
}

/* ── 6.0a–6.0d, the New Playbook wizard ───────────────────────────────────
 *
 * Four steps and three ways in. The step numbers stay the same whichever way
 * you came — the reference draws "1 Starting point · 2 Details · 3 Build Work
 * Streams · 4 Save" on all twelve screens — and only what step 1 collects
 * differs: nothing for Blank, a Playbook for Duplicate, a Work Plan for Save
 * From a Work Plan.
 *
 * The row is written at the end of step 2 rather than at the end of step 4,
 * because step 3 is a real editor and there is nowhere else to keep what it
 * does. `is_draft` keeps it off the library shelf until Save Playbook.
 */

const NEW = `${LIST}/new`;

/** Step 1 → either the source picker or straight on to Details. */
export async function chooseStartingPoint(formData: FormData) {
  await stopIfReadOnly();

  const from = String(formData.get("from") ?? "").trim();
  if (from === "duplicate" || from === "workplan") redirect(`${NEW}/source?from=${from}`);
  redirect(`${NEW}/details?from=blank`);
}

/** 6.0a-i and 6.0a-ii → Details, carrying whatever was picked. */
export async function chooseSource(formData: FormData) {
  await stopIfReadOnly();

  const from = String(formData.get("from") ?? "").trim();
  const sourceId = String(formData.get("source_id") ?? "").trim();

  if (from !== "duplicate" && from !== "workplan") redirect(NEW);
  if (!sourceId) {
    redirect(
      `${NEW}/source?from=${from}&error=${encodeURIComponent(
        from === "duplicate" ? "Choose a Playbook to duplicate." : "Choose a Work Plan to save from.",
      )}`,
    );
  }

  redirect(`${NEW}/details?from=${from}&source=${sourceId}`);
}

/**
 * Step 2 → step 3, which is where the Playbook first exists.
 *
 * The Work Streams come across here rather than in step 3, so that step 3 has
 * something to edit the moment it opens — the reference's duplicate and
 * save-from-plan screens both arrive already populated.
 */
export async function savePlaybookDetails(formData: FormData) {
  await stopIfReadOnly();

  const from = String(formData.get("from") ?? "blank").trim();
  const sourceId = String(formData.get("source") ?? "").trim();
  const draftId = String(formData.get("draft_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const shared = String(formData.get("shared_level") ?? "private").trim();

  const back = `${NEW}/details?from=${from}${sourceId ? `&source=${sourceId}` : ""}${
    draftId ? `&draft=${draftId}` : ""
  }`;
  if (!name) redirect(`${back}&error=${encodeURIComponent("A Playbook needs a name.")}`);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const level = ["private", "team", "organization"].includes(shared) ? shared : "private";

  // Coming back to step 2 with Back edits the draft rather than starting a
  // second one, so the Work Streams already built survive the round trip.
  if (draftId) {
    const { data: existing } = await supabase
      .from("whitbyos_playbooks")
      .select("id, contents, workspace_id")
      .eq("id", draftId)
      .maybeSingle();

    if (existing && existing.workspace_id === workspaceId) {
      const contents = (existing.contents ?? {}) as Record<string, unknown>;
      await supabase
        .from("whitbyos_playbooks")
        .update({
          name,
          category: category || null,
          shared_level: level,
          contents: { ...contents, description: description || null },
          updated_at: new Date().toISOString(),
        })
        .eq("id", draftId);

      redirect(`${NEW}/streams?draft=${draftId}`);
    }
  }

  const streams = await streamsForSource(from, sourceId, workspaceId);

  const { data, error } = await supabase
    .from("whitbyos_playbooks")
    .insert({
      workspace_id: workspaceId,
      name,
      category: category || null,
      contents: { description: description || null, streams },
      version: 1,
      shared_level: level,
      is_draft: true,
      created_by_user_id: user?.id ?? null,
      created_from_workplan_id: from === "workplan" && sourceId ? sourceId : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`${back}&error=${encodeURIComponent(error?.message ?? "Could not start the Playbook.")}`);
  }

  revalidatePath(ROUTE, "page");
  redirect(`${NEW}/streams?draft=${data.id}`);
}

/**
 * What step 3 opens with.
 *
 * Duplicating carries the source's Work Streams as they are. Saving from a
 * Work Plan carries the structure and nothing else — the reference's own
 * heading says "client-specific dates/owners/documents stripped, structure
 * kept", and that is a promise about what a Playbook is for.
 */
async function streamsForSource(from: string, sourceId: string, workspaceId: string) {
  if (!sourceId) return [];

  const supabase = await createClient();

  if (from === "duplicate") {
    const { data } = await supabase
      .from("whitbyos_playbooks")
      .select("contents, workspace_id")
      .eq("id", sourceId)
      .maybeSingle();

    if (!data || data.workspace_id !== workspaceId) return [];
    return readStreams(data.contents);
  }

  if (from === "workplan") return streamsFromPlan(sourceId, workspaceId);
  return [];
}

/** Reads a draft this workspace owns, or gives up. */
async function requireDraft(draftId: string) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId || !draftId) redirect(LIST);

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_playbooks")
    .select("id, contents, workspace_id, is_draft")
    .eq("id", draftId)
    .maybeSingle();

  if (!data || data.workspace_id !== workspaceId) redirect(LIST);

  const contents = (data.contents ?? {}) as Record<string, unknown>;
  return { supabase, contents, streams: readStreams(data.contents) };
}

async function writeStreams(
  draftId: string,
  contents: Record<string, unknown>,
  streams: unknown[],
) {
  const supabase = await createClient();
  await supabase
    .from("whitbyos_playbooks")
    .update({ contents: { ...contents, streams }, updated_at: new Date().toISOString() })
    .eq("id", draftId);

  revalidatePath(ROUTE, "page");
  redirect(`${NEW}/streams?draft=${draftId}`);
}

/** Step 3's "+ Add Work Stream" and "+ Add another Work Stream". */
export async function addPlaybookStream(formData: FormData) {
  await stopIfReadOnly();

  const draftId = String(formData.get("draft_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const { contents, streams } = await requireDraft(draftId);

  if (!name) redirect(`${NEW}/streams?draft=${draftId}`);
  await writeStreams(draftId, contents, [...streams, { name, tasks: [] }]);
}

/** Step 3's Edit on a Work Stream row. */
export async function renamePlaybookStream(formData: FormData) {
  await stopIfReadOnly();

  const draftId = String(formData.get("draft_id") ?? "").trim();
  const index = Number(formData.get("index"));
  const name = String(formData.get("name") ?? "").trim();
  const { contents, streams } = await requireDraft(draftId);

  if (!name || !Number.isInteger(index) || !streams[index]) {
    redirect(`${NEW}/streams?draft=${draftId}`);
  }

  const next = streams.map((stream, i) => (i === index ? { ...stream, name } : stream));
  await writeStreams(draftId, contents, next);
}

/** Step 3's ⋯ → remove. */
export async function removePlaybookStream(formData: FormData) {
  await stopIfReadOnly();

  const draftId = String(formData.get("draft_id") ?? "").trim();
  const index = Number(formData.get("index"));
  const { contents, streams } = await requireDraft(draftId);

  if (!Number.isInteger(index)) redirect(`${NEW}/streams?draft=${draftId}`);
  await writeStreams(
    draftId,
    contents,
    streams.filter((_, i) => i !== index),
  );
}

/** Step 3's "+ Add task" under a Work Stream. */
export async function addPlaybookTask(formData: FormData) {
  await stopIfReadOnly();

  const draftId = String(formData.get("draft_id") ?? "").trim();
  const index = Number(formData.get("index"));
  const title = String(formData.get("title") ?? "").trim();
  const { contents, streams } = await requireDraft(draftId);

  if (!title || !streams[index]) redirect(`${NEW}/streams?draft=${draftId}`);

  const next = streams.map((stream, i) =>
    i === index ? { ...stream, tasks: [...stream.tasks, { title }] } : stream,
  );
  await writeStreams(draftId, contents, next);
}

/** Step 3's ✕ on a task. */
export async function removePlaybookTask(formData: FormData) {
  await stopIfReadOnly();

  const draftId = String(formData.get("draft_id") ?? "").trim();
  const index = Number(formData.get("index"));
  const taskIndex = Number(formData.get("task_index"));
  const { contents, streams } = await requireDraft(draftId);

  if (!streams[index]) redirect(`${NEW}/streams?draft=${draftId}`);

  const next = streams.map((stream, i) =>
    i === index
      ? { ...stream, tasks: stream.tasks.filter((_, t) => t !== taskIndex) }
      : stream,
  );
  await writeStreams(draftId, contents, next);
}

/**
 * Step 3 → step 4. The Playbook stops being a draft and joins the library.
 *
 * A Playbook with no Work Streams is refused rather than saved empty: the one
 * thing a Playbook is is a set of Work Streams, and an empty one would sit on
 * the shelf offering nothing when somebody reaches for it.
 */
export async function finishPlaybook(formData: FormData) {
  await stopIfReadOnly();

  const draftId = String(formData.get("draft_id") ?? "").trim();
  const { streams } = await requireDraft(draftId);

  if (streams.length === 0) {
    redirect(
      `${NEW}/streams?draft=${draftId}&error=${encodeURIComponent(
        "Add at least one Work Stream before saving.",
      )}`,
    );
  }

  const supabase = await createClient();
  const { data: saved } = await supabase
    .from("whitbyos_playbooks")
    .update({ is_draft: false, updated_at: new Date().toISOString() })
    .eq("id", draftId)
    .select("version, contents")
    .single();

  // v1 — the first entry in the history, so the panel opens with "Created"
  // rather than with nothing until somebody happens to edit it. Only when
  // there is nothing there: asking Whitby on the way through has already
  // written its own entries, and "Created" after them would read as a second
  // beginning.
  const { count: recorded } = await supabase
    .from("whitbyos_playbook_versions")
    .select("playbook_id", { count: "exact", head: true })
    .eq("playbook_id", draftId);

  if (!recorded) {
    await recordVersion({
      playbookId: draftId,
      version: (saved?.version as number) ?? 1,
      contents: saved?.contents ?? {},
      reason: "Created",
    });
  }

  revalidatePath(ROUTE, "page");
  redirect(`${NEW}/saved?draft=${draftId}`);
}

/**
 * 6.0c's Ask Whitby.
 *
 * The panel reads the draft as it stands, so asking to trim or reorder acts on
 * what is on screen rather than on whatever the source once held.
 */
/**
 * Words that are somebody talking, not an instruction to redraw anything.
 *
 * Both boxes on this screen went from "the text is not empty" straight to
 * redrafting the whole Playbook and writing a new version. "thanks", "ok",
 * a stray full stop — every one of them produced a version nobody asked
 * for, on a record whose whole point is that it is the firm's considered
 * way of doing something.
 *
 * The same two gates the Work Plan panel has had since it was corrected for
 * exactly this.
 */
const PLAYBOOK_SMALL_TALK = new Set([
  "ok", "okay", "k", "kk", "yes", "yep", "yeah", "no", "nope", "thanks", "thank you",
  "thankyou", "ty", "cheers", "great", "good", "nice", "cool", "fine", "sure", "done",
  "got it", "hi", "hello", "hey", "sorry", "please", "right", "noted",
]);

function playbookSmallTalk(text: string) {
  const said = text.trim().toLowerCase().replace(/[.!…]+$/, "").replace(/\s+/g, " ");
  if (!said) return true;
  if (PLAYBOOK_SMALL_TALK.has(said)) return true;
  // A word or two with nothing to act on in it.
  return said.split(" ").filter(Boolean).length <= 2 && said.length <= 12;
}

export async function askWhitbyForStreams(formData: FormData) {
  await stopIfReadOnly();

  const draftId = String(formData.get("draft_id") ?? "").trim();
  const instruction = String(formData.get("instruction") ?? "").trim();
  const back = `${NEW}/streams?draft=${draftId}`;
  if (!instruction) redirect(back);

  /* See `playbookSmallTalk`. Saying thanks must not write a version. */
  if (playbookSmallTalk(instruction)) {
    redirect(
      `${back}&error=${encodeURIComponent("Tell me what to change about the Work Streams, in a few words.")}`,
    );
  }

  const { supabase, contents, streams } = await requireDraft(draftId);

  const { data: playbook } = await supabase
    .from("whitbyos_playbooks")
    .select("name, category, version")
    .eq("id", draftId)
    .maybeSingle();

  const { draftPlaybookStreams } = await import("@/whitbyos/lib/ai/draft-playbook");
  const drafted = await draftPlaybookStreams({
    name: (playbook?.name as string) ?? "This Playbook",
    category: (playbook?.category as string | null) ?? null,
    description:
      typeof contents.description === "string" ? (contents.description as string) : null,
    current: streams.length > 0 ? streams : undefined,
    instruction,
  });

  if (!drafted.ok) redirect(`${back}&error=${encodeURIComponent(drafted.error)}`);

  // Recorded as a version, with the instruction as its reason — the same way a
  // Work Plan's refinement is, and for the same reason: the panel reading the
  // conversation back and the Version History panel are then one record rather
  // than two that can disagree.
  const version = ((playbook?.version as number) ?? 1) + 1;
  await supabase
    .from("whitbyos_playbooks")
    .update({ version, updated_at: new Date().toISOString() })
    .eq("id", draftId);

  await recordVersion({
    playbookId: draftId,
    version,
    contents: { ...contents, streams: drafted.data },
    reason: instruction,
  });

  await writeStreams(draftId, contents, drafted.data);
}

/**
 * A Work Plan's structure, stripped down to what a Playbook keeps.
 *
 * Work Stream names, their purposes, and the titles of the steps inside them.
 * Nothing else: dates, owners, statuses, providers and the client's own
 * documents all belong to the engagement rather than to the shape of it, and
 * 6.0c's own heading promises they are left behind.
 *
 * Ordered by `sort_order`. It used to say `position`, which is not a column on
 * whitbyos_workstreams — PostgREST answered the whole query with an error, the
 * caller read the null as "no streams", and Save From a Work Plan carried none
 * of them across without ever saying so.
 */
async function streamsFromPlan(planId: string, workspaceId: string) {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("whitbyos_workplans")
    .select("id, request:whitbyos_requests!request_id (workspace_id)")
    .eq("id", planId)
    .maybeSingle();

  const request = plan?.request as unknown as { workspace_id: string } | null;
  const owner = Array.isArray(request) ? request[0] : request;
  if (!plan || owner?.workspace_id !== workspaceId) return [];

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("id, name, purpose, sort_order")
    .eq("workplan_id", planId)
    .order("sort_order");

  const ids = (streams ?? []).map((row) => row.id as string);
  const byStream = new Map<string, string[]>();

  if (ids.length > 0) {
    const { data: tasks } = await supabase
      .from("whitbyos_tasks")
      .select("title, workstream_id, created_at")
      .in("workstream_id", ids)
      .order("created_at");

    for (const task of tasks ?? []) {
      const key = task.workstream_id as string;
      byStream.set(key, [...(byStream.get(key) ?? []), task.title as string]);
    }
  }

  /*
   * And the product's name does not come with them — SRS §1.4.
   *
   * A Work Stream's purpose is written by the drafter, and the drafter writes
   * about itself: "Whitby will confirm the appointment". Carried into a
   * Playbook that sentence is copied into every plan made from it afterwards,
   * and from there into what the client is shown. The client asked for the
   * name never to reach them, so it is taken out at the one place the text
   * stops being the firm's own and becomes a template.
   */
  return (streams ?? []).map((row) => ({
    name: unbranded(row.name as string),
    purpose: unbranded((row.purpose as string | null) ?? null) ?? undefined,
    tasks: (byStream.get(row.id as string) ?? []).map((title) => ({
      title: unbranded(title),
    })),
  }));
}

/**
 * 6.1's Ask Whitby — "update a Work Stream, or draft the next version".
 *
 * A saved Playbook, so this is a version rather than an edit in place: §6.10
 * versions a Playbook rather than overwriting it silently, and the panel
 * beside this one is where that version then shows up, with the instruction
 * as its reason. The words somebody typed are a better change note than
 * anything this code could compose.
 */
export async function refinePlaybook(formData: FormData) {
  await stopIfReadOnly();

  const playbookId = String(formData.get("draft_id") ?? "").trim();
  const instruction = String(formData.get("instruction") ?? "").trim();
  const back = `${LIST}/${playbookId}`;
  if (!playbookId || !instruction) redirect(back);

  /* See `playbookSmallTalk`. */
  if (playbookSmallTalk(instruction)) {
    redirect(
      `${back}?error=${encodeURIComponent("Tell me what to change about this Playbook, in a few words.")}`,
    );
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { data: playbook } = await supabase
    .from("whitbyos_playbooks")
    .select("id, name, category, contents, version, workspace_id")
    .eq("id", playbookId)
    .maybeSingle();

  if (!playbook || playbook.workspace_id !== workspaceId) redirect(LIST);

  const contents = (playbook.contents ?? {}) as Record<string, unknown>;
  const streams = readStreams(playbook.contents);

  const { draftPlaybookStreams } = await import("@/whitbyos/lib/ai/draft-playbook");
  const drafted = await draftPlaybookStreams({
    name: playbook.name as string,
    category: (playbook.category as string | null) ?? null,
    description: typeof contents.description === "string" ? contents.description : null,
    current: streams.length > 0 ? streams : undefined,
    instruction,
  });

  if (!drafted.ok) redirect(`${back}?error=${encodeURIComponent(drafted.error)}`);

  const version = ((playbook.version as number) ?? 1) + 1;
  const next = { ...contents, streams: drafted.data };

  const { error } = await supabase
    .from("whitbyos_playbooks")
    .update({ contents: next, version, updated_at: new Date().toISOString() })
    .eq("id", playbookId);

  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);

  await recordVersion({ playbookId, version, contents: next, reason: instruction });

  revalidatePath(ROUTE, "page");
  redirect(`${back}?saved=1`);
}
