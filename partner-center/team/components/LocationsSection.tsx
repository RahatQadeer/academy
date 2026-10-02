"use client";

import { useState } from "react";
import { formatLocationLine } from "@/partner-center/team/lib/addresses";
import { LocationModal } from "@/partner-center/team/components/LocationModal";
import type { CompanyLocation, TeamPageData } from "@/partner-center/team/types";

export function LocationsSection({ data }: { data: TeamPageData }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CompanyLocation | null>(null);

  return (
    <>
      <section className="mt-8">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="m-0 text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
            Locations
          </h2>
          {data.canManage ? (
            <button
              type="button"
              className="border-0 bg-transparent p-0 text-[13.5px] font-medium"
              style={{ color: "var(--accent)", cursor: "pointer" }}
              onClick={() => setAdding(true)}
            >
              Add location
            </button>
          ) : null}
        </div>
        {data.locations.length === 0 ? (
          <div
            className="pa-partner-card px-5 py-6 text-[13.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            No locations yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.locations.map((loc) => (
              <div
                key={loc.id}
                className="pa-partner-card flex items-start justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="text-[14px] font-medium" style={{ color: "var(--ink)" }}>
                    {loc.label}
                  </div>
                  <div
                    className="mt-0.5 text-[13.5px] leading-snug"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatLocationLine(loc)}
                  </div>
                </div>
                {data.canManage ? (
                  <button
                    type="button"
                    className="shrink-0 border-0 bg-transparent p-0 text-[13.5px] font-medium"
                    style={{ color: "var(--accent)", cursor: "pointer" }}
                    onClick={() => setEditing(loc)}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
      {adding ? (
        <LocationModal companyName={data.companyName} onClose={() => setAdding(false)} />
      ) : null}
      {editing ? (
        <LocationModal
          companyName={data.companyName}
          location={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
