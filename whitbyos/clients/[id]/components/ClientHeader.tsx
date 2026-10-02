import Link from "next/link";
import { Avatar } from "@/base/components/Avatar";
import { Button } from "@/base/components/Button";
import { ArchiveOrDeleteLink } from "@/whitbyos/components/ArchiveOrDelete";
import { clientKind, contactName } from "@/whitbyos/lib/format";
import type { ClientDetail } from "@/whitbyos/lib/client-detail";

/** Breadcrumb, identity row and the New Request action, shown on every tab. */
export function ClientHeader({
  client,
  removeHref,
  photo,
}: {
  client: ClientDetail;
  /** Opens 2.0a here rather than only from the row on the list. */
  removeHref?: string;
  /**
   * The client's face, which is its primary contact's.
   *
   * A client workspace is an account rather than a person and has no
   * photograph of its own; the one it wears is the person you are actually
   * dealing with — the same rule the rail, the bar and Workspace Overview use.
   */
  photo?: string | null;
}) {
  const primary = client.primary_contact;
  const subtitle = [
    clientKind(client),
    primary ? `${contactName(primary)} (Primary Contact)` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/whitbyos/clients" className="no-underline hover:underline" style={{ color: "inherit" }}>
          Clients
        </Link>
        {" / "}
        <span style={{ color: "var(--ink)" }}>{client.name}</span>
      </div>

      <div
        className="relative mb-6 overflow-hidden rounded-[14px] border"
        style={{
          borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
          background:
            "linear-gradient(105deg, color-mix(in srgb, var(--avatar-blue-bg) 55%, var(--surface)) 0%, var(--surface) 58%)",
          boxShadow: "0 1px 2px rgba(31,72,125,.04), 0 18px 40px -28px rgba(31,72,125,.4)",
        }}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: "var(--accent)" }}
        />

        <div className="flex flex-wrap items-center gap-4 px-5 py-[18px] pl-6">
          <Avatar name={client.name} src={photo ?? undefined} size={52} className="!rounded-[14px]" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[24px] font-bold tracking-[-0.3px]">{client.name}</h1>
            <div
              className="mt-0.5 truncate text-[12.5px]"
              style={{ color: "var(--text-muted)" }}
            >
              {subtitle}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              unsized
              href={`/whitbyos/requests?client=${client.id}&new=1`}
              variant="primary"
              className="shrink-0 rounded-control px-4 py-[10px] text-[13.5px] transition-all hover:-translate-y-px"
              style={{
                boxShadow:
                  "0 1px 2px rgba(35,131,226,.35), 0 8px 18px -10px rgba(35,131,226,.8)",
              }}
            >
              + New Request
            </Button>
            {removeHref ? (
              <ArchiveOrDeleteLink href={removeHref} label="Archive client" variant="word" />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
