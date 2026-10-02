/**
 * What a Gemini call cost us, from its own token counts.
 *
 * This is the one measured number in AI billing. Everything downstream — the
 * margin, the customer charge, the meter — is arithmetic on top of it, so if
 * this is wrong or invented, every charge built on it is wrong.
 *
 * WHICH IS WHY THERE ARE NO DEFAULT RATES HERE.
 * Google's token prices are not in this project and are not guessed at. Until
 * both rates are configured, `geminiCostMicros` returns null, which travels all
 * the way through: the usage row records the tokens with no cost against them,
 * and nothing is reported to Stripe. A plausible-looking rate would be charged
 * to somebody at a number nobody chose.
 *
 * THE UNIT IS MICRO-DOLLARS, not cents. One drafting call is a few thousand
 * tokens and costs a fraction of a penny; in whole cents it rounds to zero and
 * so does a month of them. 1 USD = 1,000,000 micros; 1 cent = 10,000 micros.
 */

export const MICROS_PER_CENT = 10_000;
export const MICROS_PER_DOLLAR = 1_000_000;

/** What the model reported doing. Absent when the response carried no usage. */
export type GeminiUsage = {
  model: string;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type GeminiRates = {
  /** USD per million input tokens, as Google publishes it. */
  inputPerMillion: number;
  /** USD per million output tokens. */
  outputPerMillion: number;
};

function rate(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;

  const parsed = Number(raw);
  // Zero is a legitimate rate — a free tier — so only a non-number or a
  // negative is refused. Both mean somebody typed something wrong, and
  // treating that as free would undercharge silently.
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
}

/**
 * The configured rates for one provider, or null when either is missing.
 *
 * Both or neither: pricing input tokens but not output tokens would produce a
 * cost that is confidently too low rather than honestly absent.
 */
function ratesFrom(prefix: string): GeminiRates | null {
  const inputPerMillion = rate(`${prefix}_INPUT_COST_PER_MTOK`);
  const outputPerMillion = rate(`${prefix}_OUTPUT_COST_PER_MTOK`);

  if (inputPerMillion === null || outputPerMillion === null) return null;

  return { inputPerMillion, outputPerMillion };
}

export function geminiRates(): GeminiRates | null {
  return ratesFrom("GEMINI");
}

/**
 * Whose prices apply to the model that actually ran.
 *
 * Two providers now, and their prices are not in the same range. Charging a
 * DeepSeek call at Gemini's configured rate would overstate it by more than an
 * order of magnitude — and the rule at the top of this file is that a number
 * nobody chose is never charged to anybody. So each provider reads its own
 * pair, and a provider with no rates configured records tokens and no cost,
 * exactly as Gemini does before it is priced.
 */
export function ratesForModel(model: string): GeminiRates | null {
  return ratesFrom(model.toLowerCase().startsWith("deepseek") ? "DEEPSEEK" : "GEMINI");
}

export function geminiPricingConfigured(): boolean {
  return geminiRates() !== null;
}

/**
 * What this generation cost us, in micro-dollars. Null when unpriced.
 *
 * Rounded once at the end rather than per token class, so the two halves
 * cannot each round up and overstate a call by two micros.
 */
export function geminiCostMicros(
  usage: GeminiUsage,
  rates = ratesForModel(usage.model),
): number | null {
  if (!rates) return null;

  const prompt = Math.max(0, usage.promptTokens);
  const output = Math.max(0, usage.outputTokens);

  // A rate is USD per million tokens, and a micro-dollar is a millionth of a
  // dollar, so `tokens * rate` is already the cost in micros. Dividing by a
  // million and multiplying back is the same sum with two rounding errors in
  // it: 63 and 358 tokens at $1.50/$9.00 is exactly 3316.5 micros, and that
  // route produced 3316.4999999999995 and rounded it the wrong way.
  return Math.round(prompt * rates.inputPerMillion + output * rates.outputPerMillion);
}

/** Micro-dollars as money, for a screen or a log line. */
export function microsToMoney(micros: number, currency = "USD"): string {
  return (micros / MICROS_PER_DOLLAR).toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}
