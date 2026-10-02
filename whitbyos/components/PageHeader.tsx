import { isWorkspaceReadOnly } from "@/whitbyos/lib/read-only";
import { PageHelp } from "@/whitbyos/settings/components/PageHelp";

/**
 * Title, optional subtitle, optional right-aligned action — the top of every
 * Whitby list screen.
 *
 * Neither the size nor the space beneath it is constant in the reference, and
 * they do not move together, so both are passed rather than guessed:
 *
 *   Clients, Contacts, Providers      24px, 22px beneath
 *   Requests                          26px, 20px
 *   Documents                         22px, 20px
 *   My Tasks, Work Plans, Reports     22–24px, 24px
 *   Integrations                      22px, with a subtitle instead of a gap
 *
 * Integrations is the one that breaks the shape: its heading sits 6px above a
 * line of description, and the 26px of air comes after that rather than after
 * the title.
 *
 * `help` is the ⓘ beside the title (Settings uses the same control): a short
 * explanation of the page, not a second subtitle.
 */
export async function PageHeader({
  title,
  subtitle,
  help,
  action,
  size = 24,
  gap = 24,
}: {
  title: string;
  subtitle?: string;
  help?: string;
  action?: React.ReactNode;
  size?: 22 | 23 | 24 | 26;
  gap?: number;
}) {
  // The action beside a list title is, on all 31 of these screens, the way to
  // create the thing the list holds. A read-only workspace cannot, so it is
  // dropped here rather than in each screen: one place to be right, and no
  // screen left drawing a button that only refuses.
  const readOnly = await isWorkspaceReadOnly();
  return (
    <div style={{ marginBottom: subtitle ? 26 : gap }}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <h1
            className="font-bold tracking-[-0.3px]"
            style={{ fontSize: size, marginBottom: subtitle ? 6 : 0 }}
          >
            {title}
          </h1>
          {help ? (
            <div className="mt-0.5">
              <PageHelp text={help} />
            </div>
          ) : null}
        </div>
        {readOnly ? null : action}
      </div>

      {subtitle ? (
        <p
          className="max-w-[42rem] text-[13.5px] leading-[1.55]"
          style={{ color: "var(--text-soft)" }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
