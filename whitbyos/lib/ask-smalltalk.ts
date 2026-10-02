/**
 * Reading the question before going and looking anything up.
 *
 * "ok" is not a question. It was being sent through the whole apparatus all
 * the same — the brief loaded, the model asked, four sections and a directory
 * of everybody in the workspace printed underneath it — so acknowledging
 * Whitby produced another briefing, and acknowledging that one produced a
 * third. A conversation cannot end while every turn asks for the next one.
 *
 * Matched whole and exactly, never by keyword. "ok" is an acknowledgement and
 * "ok what about the visa" is a question, and the difference between them is
 * the rest of the sentence.
 */

const ACKNOWLEDGEMENTS = new Set([
  "ok",
  "okay",
  "okey",
  "oki",
  "k",
  "kk",
  "yes",
  "yeah",
  "yep",
  "yup",
  "no",
  "nope",
  "fine",
  "good",
  "great",
  "nice",
  "cool",
  "perfect",
  "lovely",
  "awesome",
  "sure",
  "alright",
  "all right",
  "right",
  "noted",
  "understood",
  "done",
  "clear",
  "got it",
  "gotcha",
  "makes sense",
  "sounds good",
  "good to know",
  "all good",
  "no problem",
  "never mind",
  "nevermind",
  "nothing",
  "hmm",
  "hm",
]);

const THANKS = new Set([
  "thanks",
  "thank you",
  "thankyou",
  "ty",
  "cheers",
  "thanks a lot",
  "thank you so much",
  "thanks so much",
  "ok thanks",
  "okay thanks",
  "ok thank you",
  "great thanks",
  "perfect thanks",
  "nice thanks",
  "cool thanks",
  "thanks ok",
]);

const GREETINGS = new Set(["hi", "hello", "hey", "hi there", "hello there"]);

function plainly(question: string) {
  return question
    .trim()
    .toLowerCase()
    .replace(/[.!,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The whole reply, when the turn is not asking for one — otherwise null, and
 * the question goes on to be answered properly.
 *
 * A question mark disqualifies anything: "ok?" is asking for confirmation, not
 * giving it.
 */
export function smallTalkReply(question: string): string | null {
  const text = plainly(question);
  if (!text || text.includes("?")) return null;
  if (GREETINGS.has(text)) return "Hello. Ask me anything about this workspace.";
  if (THANKS.has(text)) return "Any time. Ask whenever you need the next thing.";
  if (ACKNOWLEDGEMENTS.has(text)) return "Noted. Ask whenever you need anything else.";
  return null;
}
