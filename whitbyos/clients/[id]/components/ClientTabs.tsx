import Link from "next/link";

/**
 * The five tabs screen 2.1 draws, plus Billing.
 *
 * SRS §5.3.3 describes six sections of a Client, three of which the design
 * gives no tab: Preferences and Handling (section 2), the rest of Work
 * (section 4) and Account (section 5). They are not dropped — they sit on
 * Overview, which is where a section with no tab of its own belongs. Contacts
 * carries People and Authority (section 3); Timeline carries History
 * (section 6).
 */
export const CLIENT_TABS = [
  { slug: "", label: "Overview" },
  { slug: "requests", label: "Requests" },
  { slug: "contacts", label: "Contacts" },
  { slug: "documents", label: "Documents" },
  // Billing is not one of the export's five. §5.3.3's Account section put the
  // client's money on Overview when there was nothing to put there but a
  // "not connected" note; there are invoices now, and a list of them does not
  // belong in a 280px column beside Preferences.
  { slug: "billing", label: "Billing" },
  { slug: "timeline", label: "Timeline" },
] as const;

export type ClientTabSlug = (typeof CLIENT_TABS)[number]["slug"];

/** Underlined tab strip. The active tab carries a 2px ink underline. */
export function ClientTabs({
  clientId,
  active,
  requestCount,
  accessWaiting,
}: {
  clientId: string;
  active: ClientTabSlug;
  requestCount: number;
  /**
   * This client has asked for somebody to be given access and nobody has
   * answered. The panel that answers it is on Contacts, so the dot goes on
   * Contacts — the rail's own dot says a request is waiting somewhere, and
   * this says which tab of which client.
   */
  accessWaiting?: boolean;
}) {
  const base = `/whitbyos/clients/${clientId}`;

  return (
    <div
      className="mb-6 flex flex-wrap gap-6 border-b"
      style={{ borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)" }}
    >
      {CLIENT_TABS.map((tab) => {
        const isActive = tab.slug === active;
        const label =
          tab.slug === "requests" ? `Requests (${requestCount})` : tab.label;

        return (
          <Link
            key={tab.label}
            href={tab.slug ? `${base}/${tab.slug}` : base}
            className="flex items-center gap-1.5 pb-2.5 text-[13.5px] no-underline transition-colors"
            style={{
              color: isActive ? "var(--ink)" : "var(--text-tertiary)",
              fontWeight: isActive ? 600 : 400,
              borderBottom: isActive
                ? "2px solid var(--accent)"
                : "2px solid transparent",
            }}
          >
            {label}
            {tab.slug === "contacts" && accessWaiting ? (
              <span
                aria-label="An access request is waiting"
                title="An access request is waiting"
                className="h-[6px] w-[6px] shrink-0 rounded-full"
                style={{ background: "var(--danger-solid)" }}
              />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
