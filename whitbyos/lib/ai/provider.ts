/**
 * Whitby's model adapter.
 *
 * Everything that talks to a model goes through `generateJson`, so swapping
 * provider means changing this file only. Gemini today; the callers know
 * nothing about it.
 */

import type { GeminiUsage } from "@/whitbyos/lib/ai/pricing";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Fast enough for interactive drafting, capable enough for structured output.
 *
 * Pinned to a model the key can actually reach. A key issued today does not
 * list `gemini-3.5-flash`, and asking for a model that is not on the key is a
 * 404 — which the grounded search swallows, because that lookup is never
 * fatal. The visible symptom was plans with no contact details on them, and
 * nothing anywhere saying why.
 */
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** OpenAI-shaped, so one POST rather than a client library. */
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
/**
 * The fast one, deliberately.
 *
 * `deepseek-v4-pro` reasons before it answers and spent 8,192 tokens and 155
 * seconds doing so on one Work Plan, returning nothing at all — past the 45
 * second deadline below, with the whole output budget gone on thinking.
 * `deepseek-flash` with thinking off drafts the same plan in 19 seconds.
 */
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-flash";

/**
 * Long enough for a whole Work Plan.
 *
 * A plan of four Work Streams with four steps each, every step carrying its
 * description, rationale, inputs and resources, is several thousand tokens of
 * JSON. DeepSeek own default stops well short of that, and a truncated
 * response is not a short plan: it is invalid JSON and no plan at all.
 *
 * Raised from 8,192 after a fifteen-task event plan ran past it. A complex
 * plan with steps, inputs and contacts on every task measures about 6,600
 * tokens, and the ceiling has to sit well clear of the largest real answer
 * rather than just above the average one.
 */
const DEEPSEEK_TOKENS = 16_384;

/**
 * Which model answers a drafting call.
 *
 * `AI_PROVIDER` decides where it is set; otherwise DeepSeek takes it when its
 * key is present. Only `generateJson` is affected: reading a scanned passport
 * and searching the live web are things DeepSeek's API does not do at all, and
 * those two stay on Gemini rather than quietly returning less.
 */
function drafter(): "gemini" | "deepseek" {
  const choice = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (choice === "gemini") return "gemini";
  if (choice === "deepseek") return "deepseek";
  return process.env.DEEPSEEK_API_KEY ? "deepseek" : "gemini";
}

/**
 * Long enough for a scanned document's worth of text.
 *
 * The default is a few thousand tokens, which a transcription reaches part way
 * down page three and then stops mid-sentence.
 */
const TRANSCRIPTION_TOKENS = 32_768;

/**
 * What the call actually spent, from Gemini's own `usageMetadata`.
 *
 * The measurement lives here because this is the only file that sees a model
 * response. Every generation in the product goes through the two functions
 * below, so measuring here measures all of them, and no caller has to remember
 * to. A response without a usage block returns null rather than a zero, which
 * would read as a call that cost nothing.
 */
function readUsage(body: unknown, model: string): GeminiUsage | null {
  const meta = (body as { usageMetadata?: Record<string, unknown> } | null)?.usageMetadata;
  if (!meta) return null;

  const count = (value: unknown) => (typeof value === "number" && value >= 0 ? value : 0);

  // `thoughtsTokenCount` is billed as output on a thinking model and is absent
  // on the others, so it is added rather than assumed either way.
  const prompt = count(meta.promptTokenCount);
  const output = count(meta.candidatesTokenCount) + count(meta.thoughtsTokenCount);
  const total = count(meta.totalTokenCount) || prompt + output;

  if (total === 0) return null;

  return { model, promptTokens: prompt, outputTokens: output, totalTokens: total };
}

/**
 * Write the measurement down, without ever getting in the way.
 *
 * Deliberately not awaited and deliberately unable to throw: billing must never
 * be the reason a professional's drafting fails. The workspace is resolved
 * lazily so this file stays a plain adapter that can be imported anywhere, and
 * a call made outside a request context simply records nothing.
 */
function meter(usage: GeminiUsage | null, feature: string, workspaceId?: string) {
  if (!usage) return;

  void (async () => {
    try {
      const [{ recordAiUsage }, { getCurrentWorkspaceId }] = await Promise.all([
        import("@/whitbyos/lib/ai/usage"),
        import("@/whitbyos/lib/workspace"),
      ]);

      const id = workspaceId ?? (await getCurrentWorkspaceId());
      if (!id) return;

      await recordAiUsage({ workspaceId: id, usage, feature });
    } catch {
      return;
    }
  })();
}

export type AiResult<T> =
  | { ok: true; data: T; usage?: GeminiUsage }
  | { ok: false; error: string };

export function isAiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY);
}

/**
 * Asks the model for JSON matching `schema` and returns it parsed.
 *
 * Never throws: Whitby drafting is assistance, and a model that is slow, over
 * quota or malformed must degrade into an error the professional can see and
 * work around, not a crash mid-flow.
 */
export async function generateJson<T>({
  system,
  prompt,
  schema,
  signal,
  workspaceId,
  feature = "generate",
  images,
}: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
  /**
   * Whose bill this is. Optional: resolved from the session when absent, which
   * covers every screen. A background job with no session — the Gmail sync —
   * knows its workspace and passes it, because there is nothing to resolve.
   */
  workspaceId?: string;
  /** Which part of the product spent it, for reading usage back later. */
  feature?: string;
  /** A photograph the professional attached. Gemini only; DeepSeek cannot see. */
  images?: { mimeType: string; data: string }[];
}): Promise<AiResult<T>> {
  const withEyes = Boolean(images?.length);
  if (drafter() === "deepseek" && !withEyes) {
    return deepseekJson<T>({ system, prompt, schema, signal, workspaceId, feature });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "No model is configured for this workspace." };

  const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
    { text: prompt },
  ];
  for (const image of images ?? []) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }

  try {
    const response = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.4,
        },
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      return {
        ok: false,
        error: body?.error?.message ?? `Model request failed (${response.status}).`,
      };
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    // Measured before the text is checked: a response that spent tokens and
    // then returned nothing usable still cost us money.
    const usage = readUsage(body, MODEL);
    meter(usage, feature, workspaceId);

    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, error: "The model returned nothing to work with." };

    return { ok: true, data: JSON.parse(text) as T, ...(usage ? { usage } : {}) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "The model took too long to respond." };
    }
    return { ok: false, error: "Could not reach the model. Try again in a moment." };
  }
}

/**
 * The same question, put to DeepSeek.
 *
 * Gemini is told the shape in `responseSchema` and holds the model to it.
 * DeepSeek has no equivalent — it answers `{"type":"json_object"}` and
 * nothing stronger, and asking it for `json_schema` is refused outright — so
 * the schema is written into the conversation instead, and the answer is
 * checked on the way back rather than trusted.
 *
 * That difference matters more than it looks. The reason a plan arrives with
 * a duration and a predecessor on every step is that the schema says those
 * are required; here, saying so is all there is.
 */
async function deepseekJson<T>({
  system,
  prompt,
  schema,
  signal,
  workspaceId,
  feature,
}: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  signal?: AbortSignal;
  workspaceId?: string;
  feature: string;
}): Promise<AiResult<T>> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { ok: false, error: "No model is configured for this workspace." };

  const shape = [
    system,
    "",
    "Answer with a single JSON object and nothing else. No prose around it, no code fence.",
    "It must match this JSON Schema exactly. Every property named in a \"required\" list must be present on every object that has one, including objects nested inside arrays:",
    "",
    JSON.stringify(schema),
  ].join("\n");

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal,
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: shape },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: DEEPSEEK_TOKENS,
        // Reasoning tokens come out of the same budget as the answer, and
        // these models will spend all of it thinking and return an empty
        // string. The plan is the thinking; it does not need a rehearsal.
        thinking: { type: "disabled" },
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      return {
        ok: false,
        error: body?.error?.message ?? `Model request failed (${response.status}).`,
      };
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: Record<string, unknown>;
    };

    // Measured before the text is checked, for the same reason as above: a
    // response that spent tokens and returned nothing usable still cost money.
    const usage = readOpenAiUsage(body.usage, DEEPSEEK_MODEL);
    meter(usage, feature, workspaceId);

    const choice = body.choices?.[0];
    const text = choice?.message?.content;
    if (!text) return { ok: false, error: "The model returned nothing to work with." };

    // A plan cut off at the token ceiling is not a shorter plan, it is broken
    // JSON — and saying so is more use than a parse error.
    if (choice?.finish_reason === "length") {
      return {
        ok: false,
        error:
          "The draft ran longer than the model could finish. Try a smaller plan size.",
      };
    }

    try {
      return { ok: true, data: JSON.parse(unfence(text)) as T, ...(usage ? { usage } : {}) };
    } catch {
      return { ok: false, error: "The model's answer was not valid JSON. Try again." };
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "The model took too long to respond." };
    }
    return { ok: false, error: "Could not reach the model. Try again in a moment." };
  }
}

/**
 * `prompt_tokens` rather than `promptTokenCount`.
 *
 * The same measurement in OpenAI's spelling, mapped onto the one shape the
 * meter and the pricing table understand.
 */
function readOpenAiUsage(
  meta: Record<string, unknown> | undefined,
  model: string,
): GeminiUsage | null {
  if (!meta) return null;

  const count = (value: unknown) => (typeof value === "number" && value >= 0 ? value : 0);

  const prompt = count(meta.prompt_tokens);
  const output = count(meta.completion_tokens);
  const total = count(meta.total_tokens) || prompt + output;

  if (total === 0) return null;

  return { model, promptTokens: prompt, outputTokens: output, totalTokens: total };
}

/** A fenced block where a bare object was asked for, which happens anyway. */
function unfence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}

/**
 * The same model, handed a file and asked what it says.
 *
 * This is how a scanned PDF gets in. A scan has no text layer — it is a
 * photograph of a page — so no parser can help, and the only thing that reads
 * it is something that can look at it. Gemini takes a PDF as an attachment and
 * does its own page rendering, which is why there is no image conversion here
 * and no OCR library in the project.
 *
 * Temperature is zero and the instruction says transcribe rather than
 * summarise, because the caller wants what the page says, not what the model
 * makes of it. What it means is decided later, by the drafting call.
 */
export async function transcribeFile({
  data,
  mimeType,
  signal,
  workspaceId,
  feature = "transcribe",
}: {
  /** The file itself, base64-encoded. */
  data: string;
  mimeType: string;
  signal?: AbortSignal;
  workspaceId?: string;
  feature?: string;
}): Promise<AiResult<string>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "No model is configured for this workspace." };

  try {
    const response = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: [
                "You transcribe documents. Return exactly what the pages say, as plain text.",
                "Keep the reading order, the headings, and the indentation of any list.",
                "Render a table as one row per line with ' | ' between cells.",
                "Start each page with a line reading '--- Page N ---'.",
                "Do not summarise, do not explain, do not add anything the page does not say.",
                "Where the scan is unreadable, write [illegible] rather than guessing.",
              ].join(" "),
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ inlineData: { mimeType, data } }, { text: "Transcribe this document." }],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: TRANSCRIPTION_TOKENS },
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      return {
        ok: false,
        error: body?.error?.message ?? `Model request failed (${response.status}).`,
      };
    }

    const body = (await response.json()) as {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string }[] };
      }[];
    };

    const usage = readUsage(body, MODEL);
    meter(usage, feature, workspaceId);

    const candidate = body.candidates?.[0];
    // Every part, not the first: a long transcription arrives in several.
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      // A refusal or a safety stop looks the same as an empty page from here,
      // so the reason is passed through rather than guessed at.
      return {
        ok: false,
        error:
          candidate?.finishReason && candidate.finishReason !== "STOP"
            ? `The model stopped before reading it (${candidate.finishReason}).`
            : "The model returned nothing to work with.",
      };
    }

    return {
      ok: true,
      data:
        candidate?.finishReason === "MAX_TOKENS"
          ? `${text}\n\n[\u2026transcription stopped here \u2014 the document was longer than one pass]`
          : text,
      ...(usage ? { usage } : {}),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "The model took too long to read it." };
    }
    return { ok: false, error: "Could not reach the model. Try again in a moment." };
  }
}

export type GroundedAnswer = {
  text: string;
  /** Where it came from — the URLs the search actually returned. */
  sources: { title: string; url: string }[];
};

/**
 * The same model, allowed to search the web first.
 *
 * A drafting call cannot do this itself. Gemini refuses `responseSchema`
 * alongside a tool, so a grounded answer and a strictly shaped one are two
 * different requests — which is the right shape anyway: research is a separate
 * step whose answer becomes context for the drafting, and it is the only call
 * in the product allowed out to the open web.
 *
 * The sources come back from `groundingMetadata`, not from the model's prose.
 * That is the whole reason this exists: a URL the model wrote is a URL it may
 * have invented, and a URL the search returned is one that was actually found.
 * Callers pass the sources through to the plan, and everything not in this list
 * is marked unverified on the screen.
 *
 * Failure is not an error here. A plan without external links is a smaller
 * plan, not a broken one, so this returns null and the drafting goes ahead.
 */
export async function researchGrounded({
  prompt,
  signal,
  workspaceId,
  feature = "research",
}: {
  prompt: string;
  signal?: AbortSignal;
  workspaceId?: string;
  feature?: string;
}): Promise<GroundedAnswer | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  /**
   * Grounded search is the flakiest call this product makes, and the quietest
   * when it fails.
   *
   * It is deliberately never fatal, so a 503 — which this model returns under
   * load often enough to matter — costs the whole plan its phone numbers and
   * says nothing. Measured on this key: one refusal in a handful of calls, and
   * the next attempt succeeds in about five seconds. So it asks again rather
   * than giving the plan up for a spike in somebody else's traffic.
   *
   * Only for the transient refusals. A 400 is a request that will be wrong
   * again, and a 404 is a model this key does not have; asking those twice
   * wastes ten seconds of the professional's wait to reach the same answer.
   */
  /*
   * Each attempt gets its own clock.
   *
   * The caller's signal is one deadline for the whole step, and all three
   * attempts were sharing it. A real grounded query against this key takes
   * about sixteen seconds, so on a 35 second budget the second attempt
   * starts with nineteen left and the third is born already dead: it aborts
   * part-way, reports a failure that is really our own stopwatch, and the
   * plan says it could not reach the web.
   *
   * So an attempt is given a slice it can actually finish in, and the
   * caller's signal still ends the lot whenever it says so.
   */
  const ATTEMPT_MS = 20_000;

  for (let attempt = 0; ; attempt += 1) {
    const own = AbortSignal.timeout(ATTEMPT_MS);
    const clock = signal ? AbortSignal.any([signal, own]) : own;

    const answer = await askGrounded(key, prompt, clock, workspaceId, feature);
    if (answer.ok) return answer.data;

    /* The whole step is over, not just this try. Nothing is gained by
       waiting 900ms to ask again on a signal that has already fired. */
    if (signal?.aborted) return null;
    if (!answer.retryable || attempt >= 2) return null;

    await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
  }
}

/**
 * The same lookup, saying why it came back empty.
 *
 * `researchGrounded` returns null for both "there was nothing to find" and
 * "the model refused three times", and those are different facts: the first is
 * an answer, the second is a plan quietly missing every phone number it should
 * have had. The screen has to be able to tell them apart to offer the right
 * thing, so this reports the outcome and the plain version stays for callers
 * that only want the text.
 */
export async function researchGroundedWithState(input: {
  prompt: string;
  signal?: AbortSignal;
  workspaceId?: string;
  feature?: string;
}): Promise<{ state: "ok" | "empty" | "failed" | "skipped"; answer: GroundedAnswer | null }> {
  if (!process.env.GEMINI_API_KEY) return { state: "skipped", answer: null };

  const key = process.env.GEMINI_API_KEY;

  for (let attempt = 0; ; attempt += 1) {
    const answer = await askGrounded(
      key,
      input.prompt,
      input.signal,
      input.workspaceId,
      input.feature ?? "research",
    );

    if (answer.ok) {
      return answer.data
        ? { state: "ok", answer: answer.data }
        : { state: "empty", answer: null };
    }

    if (!answer.retryable || attempt >= 2) {
      /*
       * Said out loud, because the screen cannot say it.
       *
       * The plan ends up with "Whitby could not reach the web", which is
       * true and useless: the reason — a quota, a refused key, a timeout,
       * the network — was thrown away here, so every one of them looked
       * identical and none could be acted on.
       */
      console.error(
        `[whitby] grounded search failed after ${attempt + 1} ${attempt === 0 ? "try" : "tries"}: ${answer.why}`,
      );
      return { state: "failed", answer: null };
    }

    await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
  }
}

type GroundedAttempt =
  | { ok: true; data: GroundedAnswer | null }
  /** `why` is for the log, not the screen: it names what actually refused. */
  | { ok: false; retryable: boolean; why: string };

async function askGrounded(
  key: string,
  prompt: string,
  signal: AbortSignal | undefined,
  workspaceId: string | undefined,
  feature: string,
): Promise<GroundedAttempt> {
  try {
    const response = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `You look up practical, current details for a private-client services firm: official websites, booking pages, the authority that handles a thing, opening hours, published telephone numbers and addresses.

Report only what the search actually returned. Never fill a gap with a plausible number, address or URL — a contact detail that looks right and is wrong is worse than none, because somebody dials it. Where you could not find something, say that you could not.

Prefer official and primary sources: the government department itself, the embassy itself, the company's own site. Answer in short, factual lines, each naming what it is and where it came from.`,
            },
          ],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      // 429 is the quota, which clears; 503 is load, which passes. The rest
      // will say the same thing next time.
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        retryable: response.status === 429 || response.status === 503,
        why: `HTTP ${response.status} ${detail.slice(0, 300)}`,
      };
    }

    const body = (await response.json()) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
        groundingMetadata?: {
          groundingChunks?: { web?: { uri?: string; title?: string } }[];
        };
      }[];
    };

    meter(readUsage(body, MODEL), feature, workspaceId);

    const candidate = body.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!text) return { ok: true, data: null };

    const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .flatMap((chunk) => {
        const url = chunk.web?.uri;
        if (!url) return [];
        return [{ title: chunk.web?.title ?? url, url }];
      })
      // The same page is often cited several times over one answer.
      .filter(
        (source, index, all) => all.findIndex((other) => other.url === source.url) === index,
      );

    return { ok: true, data: { text, sources } };
  } catch (error) {
    // A timeout is the whole budget gone; asking again would blow it twice.
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      retryable: !timedOut,
      why: timedOut
        ? "timed out"
        : error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error),
    };
  }
}
