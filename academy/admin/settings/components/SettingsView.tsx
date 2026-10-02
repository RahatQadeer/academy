"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Toggle } from "@/base/components/Toggle";
import { saveAcademySettingsAction } from "../actions";
import type { AcademyAdminSettings } from "../types";
import { SettingsRow } from "./SettingsRow";

export function SettingsView({ initial }: { initial: AcademyAdminSettings }) {
  const [settings, setSettings] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function persist(next: AcademyAdminSettings) {
    const previous = settings;
    setSettings(next);
    setError(null);
    startTransition(async () => {
      const result = await saveAcademySettingsAction(next);
      if (!result.ok) {
        setSettings(previous);
        setError(
          result.reason === "unauthorized"
            ? "You need Academy Admin access to change these settings."
            : result.reason === "forbidden_global"
              ? "Only Academy Super Admin can change platform identity settings."
              : result.message || "Settings could not be saved. Try again in a moment.",
        );
        return;
      }
      setSettings(result.settings);
      setSavedAt(Date.now());
    });
  }

  return (
    <div className="max-w-[860px]">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.4px]" style={{ color: "var(--ink)" }}>
            Academy Settings
          </h1>
          <p className="mt-2 text-[14px] leading-[1.55]" style={{ color: "var(--text-secondary)" }}>
            Publishing rules and defaults for the catalog.
          </p>
        </div>
        <p className="shrink-0 pt-2 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {pending ? "Saving…" : savedAt ? "Saved" : null}
        </p>
      </header>

      {error ? (
        <p
          className="mt-5 rounded-[8px] border px-3.5 py-2.5 text-[13.5px]"
          style={{
            background: "var(--warning-bg)",
            borderColor: "var(--warning-border, #f2e2ca)",
            color: "var(--warning-fg, #7a5a2e)",
          }}
        >
          {error}
        </p>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-[10px] border bg-white" style={{ borderColor: "var(--border)" }}>
        <SettingsRow
          title="Instructor publish approval"
          description="An instructor can create and edit content in assigned programs, but must submit for Admin approval before it can be published."
          control={
            <Toggle
              id="instructor-publish-approval"
              checked={settings.instructorPublishApproval}
              onChange={(instructorPublishApproval) => persist({ ...settings, instructorPublishApproval })}
            />
          }
        />
        <SettingsRow
          last
          title="Whitby-assisted drafting"
          description="Offer Whitby drafting support to instructors and Admins at each stage of the course builder."
          control={
            <Toggle
              id="whitby-assisted-drafting"
              checked={settings.whitbyAssistedDrafting}
              onChange={(whitbyAssistedDrafting) => persist({ ...settings, whitbyAssistedDrafting })}
            />
          }
        />
      </section>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
        Course tags
      </h2>
      <section className="overflow-hidden rounded-[10px] border bg-white" style={{ borderColor: "var(--border)" }}>
        <SettingsRow
          last
          title="Tag bank"
          description="Built-in and custom course tags. Programs must pick exactly 3 when created. Manage them under Question bank → Tags."
          control={
            <Link
              href="/academy/admin/question-bank?tab=tags"
              className="inline-flex items-center gap-1 text-[14px] font-medium no-underline hover:text-accent-hover"
              style={{ color: "var(--accent)" }}
            >
              Manage tags →
            </Link>
          }
        />
      </section>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
        Certificates & credentials
      </h2>
      <section className="overflow-hidden rounded-[10px] border bg-white" style={{ borderColor: "var(--border)" }}>
        <SettingsRow
          last
          title="Credential review"
          description="After learners request a certificate, award it from Admin → Certificates. (Publish Approvals is only for publishing programs.)"
          control={
            <Link
              href="/academy/admin/credentials"
              className="inline-flex items-center gap-1 text-[14px] font-medium no-underline hover:text-accent-hover"
              style={{ color: "var(--accent)" }}
            >
              Open credentials →
            </Link>
          }
        />
      </section>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
        Notifications
      </h2>
      <section className="overflow-hidden rounded-[10px] border bg-white" style={{ borderColor: "var(--border)" }}>
        <SettingsRow
          last
          title="Notify learners on credential expiration"
          description="Email reminders at 90, 60, and 30 days before a timed credential expires."
          control={
            <Toggle
              id="credential-expiration-notices"
              checked={settings.credentialExpirationNotices}
              onChange={(credentialExpirationNotices) =>
                persist({ ...settings, credentialExpirationNotices })
              }
            />
          }
        />
      </section>
    </div>
  );
}
