import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

/**
 * Screen 2.1.6's export, as a real PDF.
 *
 * It used to be a print-ready web page that opened with the browser's print
 * dialog up — which works, and asks the reader to do the last step themselves:
 * choose a destination, find "Save as PDF", press it. Pressing Export should
 * hand over a file. The plan export already does exactly this, so this is the
 * same pipeline with a different document rather than a new dependency.
 *
 * Helvetica, like the plan: a standard-14 face embeds nothing, so the file is
 * a few kilobytes and anything that opens a PDF can read it.
 */

const INK = "#1f1e1c";
const MUTED = "#5f5d58";
const FAINT = "#94918b";
const LINE = "#e7e5e1";
const ACCENT = "#2383e2";
const ACCENT_SOFT = "#eaf3fd";

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
  },

  masthead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  mark: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: ACCENT_SOFT,
    color: ACCENT,
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    textAlign: "center",
    paddingTop: 14,
  },
  /* The real thing where there is one. Square, because a workspace logo is
     drawn square everywhere else in the product. */
  logo: { width: 42, height: 42, borderRadius: 11, objectFit: "contain" },

  /* A hairline in the accent under the masthead: the one piece of colour on
     a page of grey rules, so the letterhead reads as a letterhead. */
  rule: { height: 2, backgroundColor: ACCENT, width: 54, marginBottom: 16 },
  kicker: {
    fontSize: 8,
    letterSpacing: 1.1,
    color: FAINT,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
  },
  title: { fontSize: 19, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  client: { fontSize: 12, fontFamily: "Helvetica-Bold", color: MUTED },

  /* The three facts a record like this is checked against: what it covers,
     when it was taken, and how much is in it. */
  facts: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LINE,
    paddingVertical: 9,
    marginBottom: 22,
  },
  fact: { flexGrow: 1, flexBasis: 0, paddingRight: 12 },
  factLabel: { fontSize: 7.5, letterSpacing: 0.8, color: FAINT, marginBottom: 3 },
  factValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  section: { marginBottom: 16 },
  heading: {
    fontSize: 8.5,
    letterSpacing: 0.9,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: LINE,
    paddingVertical: 7,
  },
  when: { width: 104, color: FAINT, fontSize: 9 },
  body: { flexGrow: 1, flexBasis: 0, lineHeight: 1.45 },
  detail: { color: MUTED },

  empty: { color: MUTED, fontSize: 10, paddingVertical: 20 },

  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: LINE,
    paddingTop: 8,
    fontSize: 8,
    color: FAINT,
  },
});

export type TimelineGroup = {
  heading: string;
  rows: { at: string; body: string; detail: string | null }[];
};

export function TimelineDocument({
  clientName,
  firmName,
  initials,
  logo,
  rangeLabel,
  printed,
  preparedBy,
  total,
  groups,
  longDate,
}: {
  clientName: string;
  firmName: string;
  initials: string;
  /** The workspace's logo as a data URI, or null to fall back to initials. */
  logo?: string | null;
  rangeLabel: string;
  printed: string;
  preparedBy: string;
  total: number;
  groups: TimelineGroup[];
  longDate: (iso: string) => string;
}) {
  const filled = groups.filter((group) => group.rows.length > 0);

  return (
    <Document title={`${clientName} Timeline`} author={firmName || "Private Attaché"}>
      <Page size="A4" style={styles.page}>
        <View style={styles.masthead}>
          <View>
            <Text style={styles.kicker}>ACTIVITY TIMELINE</Text>
            <Text style={styles.title}>{clientName}</Text>
            <Text style={styles.client}>{firmName}</Text>
          </View>
          {logo ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={logo} style={styles.logo} />
          ) : (
            <Text style={styles.mark}>{initials}</Text>
          )}
        </View>

        <View style={styles.rule} />

        <View style={styles.facts}>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>COVERING</Text>
            <Text style={styles.factValue}>{rangeLabel}</Text>
          </View>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>EVENTS</Text>
            <Text style={styles.factValue}>{total}</Text>
          </View>
          <View style={styles.fact}>
            <Text style={styles.factLabel}>PREPARED</Text>
            <Text style={styles.factValue}>{printed}</Text>
          </View>
        </View>

        {filled.length === 0 ? (
          <Text style={styles.empty}>No activity recorded in this range.</Text>
        ) : (
          filled.map((group) => (
            <View key={group.heading} style={styles.section}>
              <Text style={styles.heading}>{group.heading.toUpperCase()}</Text>
              {group.rows.map((row, index) => (
                <View key={`${group.heading}-${index}`} style={styles.row} wrap={false}>
                  <Text style={styles.when}>{longDate(row.at)}</Text>
                  <Text style={styles.body}>
                    {row.body}
                    {row.detail ? <Text style={styles.detail}> · {row.detail}</Text> : null}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}

        <View style={styles.footer} fixed>
          {/* Who produced it, on every page — the thing a record is checked
              against after the fact. It used to share the PREPARED column with
              the date and wrapped onto two lines there. */}
          <Text>
            {[firmName || "Private Attaché", preparedBy ? `Prepared by ${preparedBy}` : null]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
