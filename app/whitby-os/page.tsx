import Link from "next/link";
import { redirect } from "next/navigation";
import { draftWorkplan, type DraftedPlan } from "@/whitbyos/lib/ai/draft-workplan";
import { isAiConfigured } from "@/whitbyos/lib/ai/provider";

/** The three the export offers under the box. */
/** Screen 0's three steps, in its words. */
const STEPS = [
  { name: "Understand", detail: "Reads your prompt for people, dates and goals" },
  { name: "Structure", detail: "Breaks it into work streams and tasks" },
  { name: "Draft", detail: "Hands you a real, editable plan in seconds" },
];

const EXAMPLES = [
  "Plan an international relocation",
  "Draft a board deck timeline",
  "Build a new-client onboarding checklist",
];

/**
 * Screens 0 and 0.1 — Whitby Prompt.
 *
 * A public page: no account, no workspace, nothing saved. Someone types what
 * they are working on and Whitby drafts a starter plan they can look at.
 *
 * The draft is real. It runs the same model call the product uses (§12.1.2),
 * against nothing — no client, no workspace, no stored rows — so what comes
 * back is genuinely drafted from their words rather than a canned example
 * dressed up as one.
 *
 * Nothing is written. There is no session here to own a row, and inventing a
 * workspace for an anonymous visitor would be worse than showing them the draft
 * and letting them decide.
 */
export default async function WhitbyPromptPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string; error?: string }>;
}) {
  const params = await searchParams;
  const prompt = (params.prompt ?? "").trim();

  if (!prompt) {
    return <Landing error={params.error} />;
  }

  if (!isAiConfigured()) {
    redirect(
      `/whitby-os?error=${encodeURIComponent("Whitby's drafting is not configured on this environment yet.")}`,
    );
  }

  const result = await draftWorkplan({
    requestTitle: prompt.slice(0, 120),
    description: prompt,
    // Nobody's client — this is somebody trying it before they have one, so the
    // draft is asked for in the abstract rather than against a name.
    clientName: "a prospective client",
  });

  if (!result.ok) {
    return <Landing error={result.error} prompt={prompt} />;
  }

  return <Preview plan={result.data} />;
}

/** Screen 0. */
function Landing({ error, prompt = "" }: { error?: string; prompt?: string }) {
  return (
    <Shell>
      <div className="mx-auto w-full max-w-[620px] px-6 py-20 text-center">
        <h1 className="mb-3 text-[32px] font-bold tracking-[-0.5px]">
          Tell Whitby what you&apos;re working on
        </h1>
        <p className="mb-8 text-[15px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
          Try it free, no account needed. Whitby drafts a request or work plan
          you can explore right away.
        </p>

        {error ? (
          <div
            className="mb-5 rounded-[8px] border px-4 py-3 text-left text-[13px]"
            style={{
              background: "var(--danger-bg)",
              borderColor: "var(--danger-border)",
              color: "var(--danger-outline-fg)",
            }}
          >
            {error}
          </div>
        ) : null}

        <form
          action="/whitby-os"
          className="mb-5 flex items-center gap-3 rounded-card border border-line-strong bg-surface px-4 py-3.5"
          style={{ boxShadow: "0 1px 3px rgba(15,15,15,.05)" }}
        >
          <span
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] text-[10px] font-bold text-white"
            style={{ background: "var(--ink)" }}
            aria-hidden
          >
            W
          </span>
          <input
            name="prompt"
            required
            defaultValue={prompt}
            placeholder="e.g. Plan a family relocation from New York to London"
            aria-label="What are you working on?"
            className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-control px-4 py-2 text-[13px] font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            Ask Whitby →
          </button>
        </form>

        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((example) => (
            <Link
              key={example}
              href={`/whitby-os?prompt=${encodeURIComponent(example)}`}
              className="rounded-full border border-line px-3.5 py-1.5 text-[12.5px] no-underline"
              style={{ color: "var(--text-secondary)" }}
            >
              {example}
            </Link>
          ))}
        </div>

        {/* Screen 0's three steps, which say what happens between the prompt
            and the plan. Without them the button is a promise with nothing
            behind it. */}
        <div className="mb-8 grid gap-3 text-left sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.name} className="rounded-[10px] border border-line px-4 py-3.5">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                aria-hidden
              >
                {index + 1}
              </span>
              <div className="mt-2 text-[13px] font-semibold">{step.name}</div>
              <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                {step.detail}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          No account needed to try it. Sign up when you&apos;re ready to save
          your work.
        </p>
      </div>
    </Shell>
  );
}

/** Screen 0.1. */
function Preview({ plan }: { plan: DraftedPlan }) {
  return (
    <Shell trying>
      <div className="mx-auto w-full max-w-[720px] px-6 py-12">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--accent)" }}>
          Drafted by Whitby
        </div>
        <h1 className="mb-2 text-[26px] font-bold tracking-[-0.3px]">{plan.planName}</h1>
        <p className="mb-8 text-[14px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
          {plan.desiredOutcome} Explore it below. Sign up to save it, connect
          real data and add your team.
        </p>

        <div className="mb-8 flex flex-col gap-3">
          {plan.workStreams.map((stream, index) => (
            <div key={`${stream.name}-${index}`} className="overflow-hidden rounded-card border border-line">
              <div
                className="flex items-center gap-2.5 px-4 py-3"
                style={{ background: "var(--surface-soft)" }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[11.5px] font-bold"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                  {stream.name}
                </span>
                <span className="shrink-0 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  {stream.steps.length} task{stream.steps.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="flex flex-col">
                {stream.steps.map((step, stepIndex) => (
                  <label
                    key={`${step.name}-${stepIndex}`}
                    className="flex items-center gap-2.5 border-t border-line px-4 py-2.5 text-[13.5px]"
                  >
                    {/* Interactive, as the export says — ticking one costs
                        nothing and is the point of a preview. */}
                    <input
                      type="checkbox"
                      className="h-[14px] w-[14px] shrink-0"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    {step.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {plan.considerations?.length ? (
          <div
            className="mb-8 rounded-card border px-5 py-4"
            style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)" }}
          >
            <div className="mb-2.5 text-[13px] font-semibold" style={{ color: "var(--warning-fg)" }}>
              Whitby also noticed
            </div>
            <div className="flex flex-col gap-2">
              {plan.considerations.map((consideration, index) => (
                <div
                  key={`${consideration.body}-${index}`}
                  className="text-[12.5px] leading-[1.6]"
                  style={{ color: "var(--warning-fg)" }}
                >
                  {consideration.body}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mb-8 flex flex-col gap-2">
          {["+ Add Work Stream", "Invite your team", "Connect calendar & documents"].map(
            (locked) => (
              <div
                key={locked}
                className="flex items-center gap-2 rounded-control border border-dashed px-3.5 py-2.5 text-[13px]"
                style={{ borderColor: "var(--border-strong)", color: "var(--text-disabled)" }}
              >
                <span aria-hidden>🔒</span>
                {locked}
              </div>
            ),
          )}
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-4 rounded-card border px-5 py-4"
          style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)" }}
        >
          <span className="text-[13px]" style={{ color: "var(--warning-fg)" }}>
            You&apos;re trying Whitby without an account, and nothing here is saved
            yet.
          </span>
          <Link
            href="/signup"
            className="shrink-0 rounded-control px-4 py-2 text-[13px] font-medium text-white no-underline hover:text-white"
            style={{ background: "var(--accent)" }}
          >
            Sign Up Free →
          </Link>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ trying, children }: { trying?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)" }}>
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3.5">
        <span className="flex items-center gap-2">
          <span
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] text-[9px] font-bold text-white"
            style={{ background: "var(--ink)" }}
            aria-hidden
          >
            PA
          </span>
          <span className="text-[13.5px] font-semibold">Private Attaché</span>
        </span>

        <span className="flex items-center gap-3.5">
          {trying ? (
            <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Trying Whitby · Not saved
            </span>
          ) : null}
          <Link href="/login" className="text-[13px] no-underline" style={{ color: "var(--ink)" }}>
            Sign in
          </Link>
          {trying ? (
            <Link
              href="/signup"
              className="rounded-control px-3.5 py-1.5 text-[13px] font-medium text-white no-underline hover:text-white"
              style={{ background: "var(--accent)" }}
            >
              Sign Up Free
            </Link>
          ) : null}
        </span>
      </header>

      {children}
    </div>
  );
}
