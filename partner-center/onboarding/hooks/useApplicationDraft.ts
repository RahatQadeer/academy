"use client";

import { useState } from "react";
import type { ApplicationData, WizardStep } from "@/partner-center/types/application";

export function useApplicationDraft(initial: ApplicationData) {
  const [data, setData] = useState<ApplicationData>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function patch(partial: Partial<ApplicationData>) {
    setData((current) => ({ ...current, ...partial }));
    setError(null);
  }

  function goTo(step: WizardStep) {
    setData((current) => ({ ...current, current_step: step }));
    setError(null);
  }

  return { data, error, pending, setError, setPending, patch, goTo };
}
