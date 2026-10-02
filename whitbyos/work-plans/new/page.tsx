import Link from "next/link";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { cn } from "@/base/lib/cn";
import { WizardChrome } from "@/whitbyos/components/WizardChrome";
import { CONTROL_UNSIZED, Field } from "@/whitbyos/components/Field";
import {
  goToConfigure,
  goToImport,
  goToPlaybook,
  startFromScratch,
} from "@/whitbyos/work-plans/actions";
import { listClients } from "@/whitbyos/lib/clients";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";

const LIST = "/whitbyos/work-plans";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * WP.3 — Step 1, how to build this Work Plan.
 *
 * The reference opens this already knowing the client ("For Hartwell Family"),
 * because it is reached from inside one.
 *
 * So does this, whenever one is open. Whose work a screen is showing is
 * chosen once on Workspace Overview and answered the same way everywhere —
 * and a picker offering the other four clients while the rail, the header and
 * every other screen are showing this one is a question that has already been
 * answered, sitting exactly where somebody could answer it differently by
 * accident.
 *
 * With All clients open there is nothing to inherit, and then it is asked
 * here: the plan cannot be created without it, since a Work Plan hangs off a
 * Request and a Request belongs to a client (§6.6.1).
 */
export default async function CreateWorkPlanPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const [result, openClient, showClients] = await Promise.all([
    listClients(),
    getOpenClientId(),
    usesClientWorkspaces(),
  ]);
  const clients = showClients && result.ok ? result.rows : [];
  const error = one(searchParams?.error);
  const preset = one(searchParams?.client) ?? openClient ?? "";

  /* The one whose workspace is open, if it is one this reader can see. */
  const fixed = openClient ? clients.find((row) => row.id === openClient) ?? null : null;

  /*
   * Who the picker offers, which is not always everybody.
   *
   * With a workspace open it is that client alone — see the note on the field
   * itself. A link that names somebody else outright (`?client=`) is somebody
   * asking for them on purpose, from a screen that knows better than this one,
   * so they are offered too rather than silently falling back to None.
   */
  const offered = fixed
    ? [fixed, ...clients.filter((row) => row.id === preset && row.id !== fixed.id)]
    : clients;

  const steps = ["Choose how to build", "Configure", "Generate", "Review & Edit", "Save"];

  return (
    <WizardChrome steps={steps} current={0} backHref={LIST} backLabel="Cancel">
      {/* Top-aligned rather than centred in the frame. Vertical centring put a
          third of the screen above the heading and pushed the choices to the
          fold, which reads as an empty page with something stranded in it. */}
      <div className="flex flex-1 justify-center px-10 pb-16 pt-10">
        <div className="flex w-full max-w-[860px] flex-col gap-7">
          <div className="text-center">
            <h1 className="mb-1.5 text-[24px] font-bold">
              How do you want to build this Work Plan?
            </h1>
            <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
              You can switch approaches later.
            </p>
          </div>

          {error ? <Callout tone="danger">{error}</Callout> : null}

          {showClients && clients.length === 0 ? (
            <Callout tone="warning">
              A Work Plan is built for a client, and this workspace has none yet.{" "}
              <Link href="/whitbyos/clients?new=1">Add your first client</Link> to
              start one.
            </Callout>
          ) : (
            <form action={startFromScratch} className="flex flex-col gap-5">
              {/* In a panel of its own and the same width as the choices below
                  it. A 420px island above 860px of cards read as two unrelated
                  screens, and this is one question asked before the other. */}
              <div
                className="mx-auto grid w-full max-w-[480px] gap-4 rounded-card border p-5 sm:grid-cols-2"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  boxShadow: "0 1px 2px rgba(15,15,15,.04)",
                }}
              >
                {/*
                  * Whose plan this is, with "nobody" among the answers.
                  *
                  * Two lists, because the question is not the same one twice.
                  *
                  * With a client's workspace open, whose work this screen is
                  * showing has already been answered — on Workspace Overview,
                  * deliberately, and the rail, the header and every other
                  * screen are showing that answer. Offering the other four
                  * here puts the chance to contradict it inside a menu
                  * somebody opens for a different reason, and a plan filed
                  * under the wrong client is found weeks later. So the open
                  * client is the only client offered.
                  *
                  * None stays on both lists. Not every plan is a client's:
                  * the firm's own work is work, and so is a plan drawn before
                  * the client it is for has accepted their invitation — and
                  * that is a choice about this plan rather than a way of
                  * switching workspace, so it belongs here either way.
                  *
                  * With All clients open nothing has been answered, and the
                  * whole list is the question.
                  */}
                {showClients ? (
                  <Field label="Client" htmlFor="client_id">
                    <select
                      id="client_id"
                      name="client_id"
                      defaultValue={preset || (fixed ? fixed.id : "none")}
                      className={`${CONTROL_UNSIZED} text-[13.5px]`}
                    >
                      {/* A value of its own, because an empty select is
                          "unanswered" and this is an answer. */}
                      <option value="none">None, internal work</option>
                      {offered.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}

                <Field label="Plan name" htmlFor="name">
                  <input
                    id="name"
                    name="name"
                    placeholder="Untitled Work Plan"
                    className={`${CONTROL_UNSIZED} text-[13.5px]`}
                  />
                </Field>
              </div>

              {/* Each card submits rather than links, so the client chosen
                  above travels with the choice.

                  Build with Whitby is drawn first and wider, because it is not
                  one of four equivalent routes: it is the one that reads the
                  work, schedules it backwards from the deadline, assigns it and
                  looks up what it needs. Four identical cards said all four did
                  the same amount, which was never true and is less true now. */}
              <Card
                glyph="✦"
                title="Build with Whitby"
                body="Describe the work in plain language. Whitby plans the phases, schedules them backwards from your deadline, assigns them, and looks up the websites, contacts and documents each step needs."
                action={goToConfigure}
                lead
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <Card
                  glyph="▤"
                  title="Use a Playbook"
                  body="Start from an existing Playbook. Its Work Streams, providers and templates carry over."
                  action={goToPlaybook}
                />

                <Card
                  glyph="⇧"
                  title="Import a Work Plan"
                  body="Upload a document or worksheet. Whitby converts it into a structured Work Plan."
                  action={goToImport}
                />

                <Card
                  glyph="✎"
                  title="Start from Scratch"
                  body="Build every Work Stream and task yourself, with full control over structure."
                  submit
                />
              </div>
            </form>
          )}
        </div>
      </div>
    </WizardChrome>
  );
}

/**
 * One of the four routes.
 *
 * All four submit rather than link, because the client is chosen on this screen
 * and has to travel with the choice. Each carries its own formAction, so the
 * one form serves four destinations.
 */
function Card({
  glyph,
  title,
  body,
  action,
  submit,
  unavailable,
  lead,
}: {
  glyph: string;
  title: string;
  body: string;
  /** Where this route's step 2 lives. */
  action?: (formData: FormData) => Promise<void>;
  submit?: boolean;
  /** Why this route cannot be taken yet. Shown on the card. */
  unavailable?: string;
  /** The recommended route: wider, warmer, and laid out across. */
  lead?: boolean;
}) {
  const inner = (
    <>
      {/* Icon, name and arrow on one line; the sentence underneath. The column
          version used to put the icon and the arrow on one line and the title
          well below them, which left a band of nothing across the middle of
          every small card. */}
      <span className="flex w-full items-center gap-3">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-swatch",
            lead ? "h-[44px] w-[44px] text-[19px]" : "h-[36px] w-[36px] text-[16px]",
          )}
          style={
            lead
              ? { background: "var(--accent)", color: "#fff" }
              : { background: "var(--accent-tint)", color: "var(--accent)" }
          }
          aria-hidden
        >
          {glyph}
        </span>

        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className={lead ? "text-[16px] font-semibold" : "text-[14.5px] font-semibold"}>
            {title}
          </span>
          {lead ? <Pill tone="accent">Recommended</Pill> : null}
        </span>

        {/* Says which way pressing it goes, and gives the hover something to
            move. A card with no mark reads as a panel rather than a choice. */}
        {unavailable ? null : (
          <span
            aria-hidden
            className="pa-choice-arrow ml-auto shrink-0 pl-2 text-[15px]"
            style={{ color: "var(--text-disabled)" }}
          >
            →
          </span>
        )}
      </span>

      <span
        className={cn("text-[12.5px] leading-[1.6]", lead ? "pl-[56px]" : "")}
        style={{ color: "var(--text-secondary)" }}
      >
        {body}
      </span>

      {unavailable ? (
        <span
          className={cn("text-[11.5px]", lead ? "pl-[56px]" : "")}
          style={{ color: "var(--text-disabled)" }}
        >
          {unavailable}
        </span>
      ) : null}
    </>
  );

  if (unavailable) {
    return (
      <div
        aria-disabled
        className="flex flex-col items-start gap-2.5 rounded-card border border-line bg-surface p-[22px] text-left opacity-50"
      >
        {inner}
      </div>
    );
  }

  // Start from Scratch has no step 2 to go to, so it submits the form's own
  // action; the other three carry theirs.
  return (
    <button
      type="submit"
      formAction={submit ? undefined : action}
      className={cn(
        "pa-choice group relative flex w-full flex-col items-start gap-2.5 rounded-card border p-[20px] text-left no-underline transition-all",
        lead ? "" : "h-full",
      )}
      style={{
        color: "var(--ink)",
        borderColor: lead ? "var(--accent)" : "var(--border)",
        background: lead
          ? "linear-gradient(180deg, var(--accent-tint-mid) 0%, var(--surface) 70%)"
          : "var(--surface)",
      }}
    >
      {inner}
    </button>
  );
}
