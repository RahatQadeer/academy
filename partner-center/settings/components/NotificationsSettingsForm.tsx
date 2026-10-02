"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toggle } from "@/base/components/Toggle";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { savePartnerNotificationPrefs } from "@/partner-center/settings/lib/actions";
import {
  NOTIFICATION_ROWS,
  type NotificationPrefs,
} from "@/partner-center/settings/types";

export function NotificationsSettingsForm({
  initial,
}: {
  initial: NotificationPrefs;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  function setChannel(
    key: keyof NotificationPrefs,
    channel: "email" | "in_app",
    value: boolean,
  ) {
    setPrefs((current) => ({
      ...current,
      [key]: { ...current[key], [channel]: value },
    }));
  }

  async function onSave() {
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await savePartnerNotificationPrefs(prefs);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save notification preferences.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-[10px] border border-line bg-white">
        <div
          className="grid grid-cols-[1fr_90px_90px] border-b border-line px-[22px] py-3 text-[11.5px] font-semibold uppercase tracking-[0.03em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <div />
          <div>Email</div>
          <div>In-app</div>
        </div>
        {NOTIFICATION_ROWS.map((row, index) => {
          const value = prefs[row.key];
          const last = index === NOTIFICATION_ROWS.length - 1;
          return (
            <div
              key={row.key}
              className={`grid grid-cols-[1fr_90px_90px] items-center px-[22px] py-4 ${
                last ? "" : "border-b border-line"
              }`}
            >
              <div>
                <div
                  className="text-[13.5px] font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  {row.label}
                </div>
                <div
                  className="mt-0.5 text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {row.description}
                </div>
              </div>
              <Toggle
                id={`notif-${row.key}-email`}
                checked={value.email}
                onChange={(next) => setChannel(row.key, "email", next)}
              />
              <Toggle
                id={`notif-${row.key}-inapp`}
                checked={value.in_app}
                onChange={(next) => setChannel(row.key, "in_app", next)}
              />
            </div>
          );
        })}
      </div>

      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}
      {success ? (
        <p
          className="mt-4 mb-0 text-[13.5px]"
          style={{ color: "var(--text-secondary)" }}
          role="status"
        >
          Notification preferences saved.
        </p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={() => void onSave()}
          disabled={pending}
          unsized
          className="px-4 py-[9px] text-[13.5px]"
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </>
  );
}
