import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { PlanTask, TaskRequirement, WorkPlanDetail } from "@/whitbyos/lib/work-plans";
import type { ExportOptions } from "@/whitbyos/lib/plan-export";
import { workstreamStatusLabel } from "@/whitbyos/lib/workstream-status";
import { requirementState } from "@/whitbyos/lib/plan-requirements";

/**
 * WP.24 as a real PDF.
 *
 * The preview page draws this document in the browser so somebody can look at
 * it before sending it; this draws the same document as a file, so pressing
 * Download hands over a PDF rather than another web page to print. Two
 * renderings of one thing, which is why the options and the wording are shared
 * and only the primitives differ.
 *
 * Helvetica, not Times. The serif read as a legal notice from 1994; this
 * document is a working plan somebody prints and marks up. Still a standard-14
 * face, so nothing is embedded, the file stays a few kilobytes, and anything
 * that opens a PDF can read it.
 */

const INK = "#1f1e1c";
const MUTED = "#5f5d58";
const FAINT = "#94918b";
const LINE = "#e7e5e1";
const RULE = "#d6d3ce";
const ACCENT = "#2383e2";
const ACCENT_SOFT = "#eaf3fd";
const GREEN = "#1c7a52";
const PAPER = "#fbfaf8";

const DONE = new Set(["complete", "completed", "done"]);

/** What a required input is, in the words the screens use. */
/**
 * What may truthfully be printed beside a requirement, in brackets.
 *
 * It used to print "(not held yet)" beside anything not marked as held, which
 * nothing had checked and which a client reading the PDF would take as a
 * statement of fact. It now says one of the things actually established, or
 * nothing, and it reads the plan's ask so that a document already sent by the
 * client says so, and one the professional took off the ask says nothing at
 * all rather than going on asking for it in print.
 */
function heldNote(input: TaskRequirement, needs: NeedState | null): string {
  const state = requirementState(input, needs);
  return state ? ` (${state.text})` : "";
}

/** What the plan's ask knows, as `requirementState` wants it. */
export type NeedState = {
  asked: boolean;
  answered: Set<string>;
  guessing: boolean;
  skipped?: Set<string>;
};

const REQUIREMENT: Record<string, string> = {
  document: "Document",
  information: "Information",
  approval: "Approval",
  account: "Account or access",
  contact: "Contact",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
    /*
     * No `lineHeight` here.
     *
     * Setting it on the page inherits it into the footer, which is `fixed` and
     * absolutely positioned, and pdfkit then computes a coordinate of about
     * -2e21 and refuses to write the file: "unsupported number". It only shows
     * on a document long enough to have a second page, which is why a
     * three-task test passed and a real plan of sixteen did not.
     *
     * The leading lives on the text styles instead, where it is wanted and
     * where nothing is positioned against the page edge.
     */
  },
  /**
   * The masthead.
   *
   * A band of the firm's own colour across the head of the page, the mark and
   * the firm's name under it, then the document. It was an eyebrow, a title
   * and a 30pt square floated to the right — which is a web header, not a
   * letterhead, and on a long plan name the title ran underneath the square.
   */
  band: { height: 4, backgroundColor: INK, marginBottom: 18, flexDirection: "row" },
  bandTip: { width: 46, backgroundColor: ACCENT },

  masthead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 0.8,
    borderBottomColor: LINE,
    paddingBottom: 12,
    marginBottom: 16,
  },
  markTile: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  markLetters: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  markImage: { width: 34, height: 34, objectFit: "contain" },
  firm: { fontSize: 10, fontFamily: "Helvetica-Bold", letterSpacing: 1.1 },
  firmUnder: { fontSize: 7, letterSpacing: 1.6, color: FAINT, marginTop: 3 },
  /* flexShrink, so a long generated-on line wraps instead of reaching under
     the mark on the other side of the row. */
  mastRight: { marginLeft: "auto", flexShrink: 1, textAlign: "right" },

  eyebrow: { fontSize: 7, letterSpacing: 1.6, color: FAINT },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 6, lineHeight: 1.2 },
  meta: { fontSize: 9, color: MUTED, marginTop: 6 },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginTop: 16, marginBottom: 16 },
  outcome: { fontSize: 10, lineHeight: 1.6, color: MUTED, marginBottom: 18 },

  barTrack: { height: 4, backgroundColor: LINE, borderRadius: 2, flexGrow: 1 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  barLabel: { fontSize: 8.5, lineHeight: 1.5, color: MUTED },

  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: PAPER,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 22,
  },
  fact: {
    lineHeight: 1.5,
    width: "50%",
    flexDirection: "row",
    gap: 6,
    marginBottom: 5,
    fontSize: 9,
    paddingRight: 12,
  },
  factLabel: { fontFamily: "Helvetica-Bold", flexShrink: 0 },
  factValue: { color: MUTED, flexShrink: 1 },

  section: { marginBottom: 22 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderBottomWidth: 1.4,
    borderBottomColor: INK,
    paddingBottom: 6,
    marginBottom: 12,
  },
  headNumber: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    flexShrink: 0,
    color: "#ffffff",
    backgroundColor: INK,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  headName: { fontSize: 13, fontFamily: "Helvetica-Bold", lineHeight: 1.35, flexGrow: 1, flexShrink: 1 },
  /* flexShrink 0: the status is three or four words and must not be squeezed
     into the stream name beside it. */
  headStatus: { fontSize: 7.5, letterSpacing: 0.6, fontFamily: "Helvetica-Bold", flexShrink: 0 },

  task: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 5, marginTop: 3 },
  /*
   * The tick is drawn, not typed. Times has no ✓ and no ☐ — WinAnsi carries
   * neither — so the glyphs came out blank and as an upside-down exclamation
   * mark. Two rectangles and a border say the same thing in any font.
   */
  tick: { width: 8, height: 8, borderRadius: 2, marginTop: 2.5 },
  taskTitle: {
    flexGrow: 1,
    flexShrink: 1,
    // Without a basis of nothing the column is sized from the text, and a long
    // title runs under the owner beside it instead of wrapping.
    flexBasis: 0,
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.45,
    paddingRight: 12,
  },
  owner: { width: 88, flexShrink: 0, fontSize: 8, lineHeight: 1.5, color: MUTED, textAlign: "right" },
  due: { width: 42, flexShrink: 0, fontSize: 8, lineHeight: 1.5, color: MUTED, textAlign: "right" },
  note: { marginLeft: 16, fontSize: 8.5, lineHeight: 1.5, color: MUTED, marginBottom: 3 },

  /**
   * What a task carries under its own line, when the export asks for it.
   *
   * Indented to the title above rather than to the page, and ruled on the left
   * so a run of them reads as belonging to the task rather than as more tasks.
   */
  detail: {
    marginLeft: 16,
    marginTop: 5,
    marginBottom: 12,
    paddingLeft: 11,
    borderLeftWidth: 2,
    borderLeftColor: ACCENT_SOFT,
  },
  detailLabel: {
    fontSize: 7,
    letterSpacing: 1.1,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginTop: 9,
    marginBottom: 4,
  },
  detailText: { fontSize: 9, lineHeight: 1.6, color: MUTED, marginBottom: 2 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  stepNumber: {
    width: 13,
    flexShrink: 0,
    fontSize: 8,
    color: ACCENT,
    fontFamily: "Helvetica-Bold",
    marginTop: 1,
  },
  stepText: { flexGrow: 1, flexShrink: 1, fontSize: 9, lineHeight: 1.55 },
  /* Its own line under the step rather than floating beside it: at the right
     edge it sat against the step's last words and read as part of them. */
  stepWho: { fontSize: 7.5, lineHeight: 1.4, color: FAINT, marginLeft: 19, marginBottom: 4 },
  resource: { marginBottom: 6 },
  resourceName: { fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  resourceLine: { fontSize: 8.5, color: MUTED, lineHeight: 1.5 },

  foot: {
    position: "absolute",
    left: 52,
    right: 52,
    bottom: 26,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: FAINT,
  },
});

export type PdfExtras = {
  notes: Map<string, { nextAction: string | null; evidence: string | null }>;
  documents: Map<string, string[]>;
};

function streamInk(status: string, blocked: boolean) {
  if (blocked) return "#b3261e";
  if (DONE.has(status.toLowerCase())) return GREEN;
  if (status === "waiting") return "#7a5a2e";
  if (status === "not_started") return FAINT;
  return ACCENT;
}

/** `at_risk` is how the column spells it, not how a document should. */
function titleCase(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PlanDocument({
  plan,
  options,
  extras,
  letterhead,
  initials,
  logo,
  printed,
  layoutLabel,
  needs = null,
}: {
  plan: WorkPlanDetail;
  options: ExportOptions;
  extras: PdfExtras | null;
  letterhead: string;
  /** The workspace's monogram, drawn where there is no logo to draw. */
  initials?: string;
  /** The workspace's own logo as a data URI, or null. */
  logo?: string | null;
  printed: string;
  layoutLabel: string;
  /** The plan's ask, so the export says the same as the screen. */
  needs?: NeedState | null;
}) {
  return (
    <Document title={`${plan.name} · Work Plan`} author={letterhead || plan.client_name}>
      <Page size="A4" style={styles.page}>
        {/* The firm's band, then the firm, then the document. */}
        <View style={styles.band} fixed>
          <View style={styles.bandTip} />
        </View>

        {letterhead ? (
        <View style={styles.masthead}>
          {logo ? (
            /* eslint-disable-next-line jsx-a11y/alt-text --
               @react-pdf's Image is a PDF primitive, not an <img>: it takes no
               alt prop and the rule cannot tell the two apart. */
            <Image src={logo} style={styles.markImage} />
          ) : (
            <View style={styles.markTile}>
              <Text style={styles.markLetters}>{initials || "PA"}</Text>
            </View>
          )}

          <View>
            <Text style={styles.firm}>{(letterhead || plan.client_name).toUpperCase()}</Text>
            <Text style={styles.firmUnder}>PRIVATE CLIENT SERVICES</Text>
          </View>

          <View style={styles.mastRight}>
            <Text style={styles.eyebrow}>WORK PLAN</Text>
            <Text style={{ fontSize: 8.5, color: MUTED, marginTop: 3 }}>{printed}</Text>
          </View>
        </View>
        ) : (
          /* Letterhead off: the eyebrow and the date, and no mark. Dressing
             the client's own name as the firm's would be a letterhead nobody
             asked for, printed over somebody else's name. */
          <View style={[styles.masthead, { justifyContent: "space-between" }]}>
            <Text style={styles.eyebrow}>WORK PLAN</Text>
            <Text style={{ fontSize: 8.5, color: MUTED }}>{printed}</Text>
          </View>
        )}

        <View>
          <Text style={styles.title}>{plan.name}</Text>
          <Text style={styles.meta}>
            {[plan.client_name, `${layoutLabel} layout`].filter(Boolean).join("  ·  ")}
          </Text>
        </View>

        <View style={styles.rule} />

        {plan.desired_outcome ? <Text style={styles.outcome}>{plan.desired_outcome}</Text> : null}

        <View style={styles.barRow}>
          <View style={styles.barTrack}>
            <View
              style={{
                width: `${plan.progress}%`,
                height: 4,
                borderRadius: 2,
                backgroundColor: plan.progress >= 100 ? GREEN : ACCENT,
              }}
            />
          </View>
          <Text style={styles.barLabel}>
            {plan.taskDone} of {plan.taskTotal} complete · {plan.progress}%
          </Text>
        </View>

        <View style={styles.facts}>
          <Fact label="Status" value={titleCase(plan.status)} />
          <Fact label="Owner" value={plan.ownerName} />
          <Fact
            label="Target completion"
            value={plan.target_date ? shortDate(plan.target_date) : "Not set"}
          />
          <Fact label="Client" value={plan.client_name} />
        </View>

        {!options.streams ? (
          <Text style={{ fontSize: 10, color: MUTED }}>
            {plan.workstreams.length} Work Stream
            {plan.workstreams.length === 1 ? "" : "s"}, not listed in this export.
          </Text>
        ) : (
          plan.workstreams.map((stream, index) => {
            const ink = streamInk(stream.status, stream.blocked);
            const attached = extras?.documents.get(stream.id) ?? [];

            return (
              /* Wrapping, deliberately.
                 A Work Stream used to be four short lines and was kept whole
                 on one page. With the steps, the requirements and the contacts
                 under every task it is taller than a page, so keeping it whole
                 pushed the first one to page two and left page one blank below
                 the header. It breaks now; the task rows below are what stay
                 whole, which is the unit that actually has to hold together. */
              <View key={stream.id} style={styles.section}>
                <View style={styles.head} minPresenceAhead={60}>
                  <Text style={[styles.headNumber, { color: ink }]}>
                    {String(index + 1).padStart(2, "0")}
                  </Text>
                  <Text style={styles.headName}>{stream.name}</Text>
                  {options.meta ? (
                    <Text style={[styles.headStatus, { color: ink }]}>
                      {workstreamStatusLabel(stream.status, stream.blocked).toUpperCase()}
                    </Text>
                  ) : null}
                </View>

                {stream.tasks.length === 0 ? (
                  <Text style={{ fontSize: 9.5, color: FAINT }}>No tasks yet.</Text>
                ) : (
                  stream.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      options={options}
                      extras={extras}
                      needs={needs}
                    />
                  ))
                )}

                {attached.length > 0 ? (
                  <Text style={[styles.note, { marginTop: 4 }]}>
                    Attached: {attached.join(" · ")}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}

        <View style={styles.foot} fixed>
          <Text>
            {plan.client_name} · {plan.name}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}:</Text>
      <Text style={styles.factValue}>{value ?? ""}</Text>
    </View>
  );
}

function TaskRow({
  task,
  options,
  extras,
  needs,
}: {
  task: PlanTask;
  options: ExportOptions;
  extras: PdfExtras | null;
  /** The plan's ask, so a requirement prints what the screen says about it. */
  needs: NeedState | null;
}) {
  const complete = DONE.has(task.status.toLowerCase());
  const note = extras?.notes.get(task.id);
  const checklist = extras ? task.checklist : [];
  // `extras` is only fetched when the export asked for task detail, so its
  // presence is the switch for everything below the task's own line.
  const detailed = Boolean(extras);

  return (
    /* Wrapping. A task carrying its description, five steps, its requirements
       and its contacts is taller than what is left of a page and sometimes
       taller than a page — kept whole it was pushed to the next one and left
       the page before it empty under a heading. `minPresenceAhead` keeps the
       title from stranding at the foot on its own. */
    <View minPresenceAhead={48}>
      <View style={styles.task} wrap={false}>
        <View
          style={[
            styles.tick,
            complete
              ? { backgroundColor: GREEN }
              : { borderWidth: 1, borderColor: "rgb(200,198,193)" },
          ]}
        />
        <Text style={[styles.taskTitle, complete ? { color: MUTED } : {}]}>{task.title}</Text>
        {options.meta ? (
          <>
            <Text style={styles.owner}>{task.ownerName ?? "Unassigned"}</Text>
            {/* An en dash where there is no date, so the column reads as a
                column. Times carries it (and the em dash) through WinAnsi —
                checked by rendering one and reading it back; U+2212, the true
                minus, is the one that comes out blank. */}
            <Text style={styles.due}>{task.due_date ? shortDate(task.due_date) : "\u2013"}</Text>
          </>
        ) : null}
      </View>

      {note?.nextAction ? <Text style={styles.note}>Next: {note.nextAction}</Text> : null}
      {note?.evidence ? <Text style={styles.note}>Evidence: {note.evidence}</Text> : null}

      {/* Everything somebody needs in order to actually do the task.
          The export used to carry the title, the owner and the date — which
          is a list of what to do and not one word about how, so the file was
          a worse copy of the screen rather than something anybody could work
          from away from it. */}
      {detailed ? (
        <View style={styles.detail}>
          {task.description ? (
            <Text style={styles.detailText}>{task.description}</Text>
          ) : null}

          {checklist.length > 0 ? (
            <>
              <Text style={styles.detailLabel}>STEPS</Text>
              {checklist.map((item, index) => {
                // Only where the step is somebody else's: on a task one person
                // is doing, a name on every line is noise.
                const other =
                  item.ownerName && item.ownerName !== task.ownerName ? item.ownerName : null;

                return (
                  <View key={`${item.text}-${index}`} wrap={false}>
                    <View style={styles.step}>
                      <Text style={styles.stepNumber}>{index + 1}</Text>
                      <Text style={[styles.stepText, item.done ? { color: MUTED } : {}]}>
                        {item.text}
                      </Text>
                    </View>

                    {/* Under the step, not beside it. At the right edge it sat
                        against the step's last words and read as part of the
                        sentence. */}
                    {other ? <Text style={styles.stepWho}>{other}</Text> : null}
                  </View>
                );
              })}
            </>
          ) : null}

          {task.requiredInputs.length > 0 ? (
            <>
              <Text style={styles.detailLabel}>NEEDED BEFORE IT CAN START</Text>
              {task.requiredInputs.map((input, index) => (
                <Text key={index} style={styles.detailText}>
                  {REQUIREMENT[input.kind] ?? input.kind}: {input.label}
                  {input.why ? ` \u2014 ${input.why}` : ""}
                  {heldNote(input, needs)}
                </Text>
              ))}
            </>
          ) : null}

          {task.expectedOutput ? (
            <>
              <Text style={styles.detailLabel}>WHAT THIS PRODUCES</Text>
              <Text style={styles.detailText}>{task.expectedOutput}</Text>
            </>
          ) : null}

          {task.externalLinks.length > 0 ? (
            <>
              <Text style={styles.detailLabel}>WHERE TO GO</Text>
              {task.externalLinks.map((resource, index) => (
                <View key={index} style={styles.resource}>
                  <Text style={styles.resourceName}>
                    {resource.label}
                    {resource.verified !== true &&
                    (resource.phone || resource.email || resource.url || resource.address)
                      ? "  (check before use)"
                      : ""}
                  </Text>
                  {[resource.phone, resource.email, resource.url, resource.address]
                    .filter(Boolean)
                    .map((line, at) => (
                      <Text key={at} style={styles.resourceLine}>
                        {line}
                      </Text>
                    ))}
                </View>
              ))}
            </>
          ) : null}

          {task.providerNeed ? (
            <>
              <Text style={styles.detailLabel}>OUTSIDE FIRM NEEDED</Text>
              <Text style={styles.detailText}>
                {task.providerNeed.category}
                {task.providerNeed.why ? `. ${task.providerNeed.why}` : ""}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
