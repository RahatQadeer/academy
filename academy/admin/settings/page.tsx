import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { SettingsSkeleton } from "./components/SettingsSkeleton";
import { SettingsView } from "./components/SettingsView";
import { loadAcademySettings } from "./services/loadAcademySettings";

async function SettingsBody() {
  const result = await loadAcademySettings();

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <PageShell>
        <AdminAccessRequired />
      </PageShell>
    );
  }

  if (!result.ok) {
    return (
      <PageShell>
        <ErrorState
          title="Settings unavailable"
          body="Academy settings could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <SettingsView initial={result.settings} />
    </PageShell>
  );
}

export function AdminSettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsBody />
    </Suspense>
  );
}
