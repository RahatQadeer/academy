"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { documentStatusTone } from "@/partner-center/documents/lib/format";
import { ShareDocumentForm } from "@/super-admin/partner-center/partners/components/ShareDocumentForm";
import type { AdminPartnerDocumentsPage } from "@/super-admin/partner-center/partners/lib/load-partner-documents";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";

export function PartnerDocumentsAdminView({
  data,
}: {
  data: AdminPartnerDocumentsPage;
}) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          Agreement: {data.agreementStatus ?? "—"}
          {data.agreementDocumentId
            ? ` · ${data.agreementDocumentId.slice(0, 8)}…`
            : ""}
        </p>
        <Button type="button" variant="primary" onClick={() => setShareOpen(true)}>
          Share document
        </Button>
      </div>

      <div
        className="pa-partner-card overflow-hidden"
        style={{ borderColor: "var(--border)" }}
      >
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr style={{ background: "var(--surface-soft)" }}>
              <th className="px-3 py-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>
                Title
              </th>
              <th className="px-3 py-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>
                Kind
              </th>
              <th className="px-3 py-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>
                Status
              </th>
              <th className="px-3 py-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>
                Needed
              </th>
              <th className="px-3 py-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>
                Version
              </th>
              <th className="px-3 py-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>
                Program
              </th>
              <th className="px-3 py-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  No documents shared yet.
                </td>
              </tr>
            ) : (
              data.items.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-soft)]"
                  style={{ borderColor: "var(--border)" }}
                  onClick={() =>
                    router.push(
                      PC_ADMIN.partnerDocument(data.partnerProfileId, row.id),
                    )
                  }
                >
                  <td className="px-3 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {row.title}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                    {row.typeLabel}
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone={documentStatusTone(row.status)}>
                      {row.statusLabel}
                    </Pill>
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                    {row.neededAction?.replace(/_/g, " ") ?? "—"}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                    v{row.version}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                    {row.programLabel}
                  </td>
                  <td className="px-3 py-2.5" style={{ color: "var(--text-secondary)" }}>
                    {row.dateLabel}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {shareOpen ? (
        <ShareDocumentForm
          partnerProfileId={data.partnerProfileId}
          onClose={() => setShareOpen(false)}
          onShared={(documentId) =>
            router.push(
              PC_ADMIN.partnerDocument(data.partnerProfileId, documentId),
            )
          }
        />
      ) : null}
    </div>
  );
}
