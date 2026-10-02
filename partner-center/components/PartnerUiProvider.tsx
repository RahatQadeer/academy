"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { CopyToast } from "@/partner-center/components/states/CopyToast";
import { PartnerErrorModal } from "@/partner-center/components/states/PartnerErrorModal";

type ErrorState = {
  message?: string | null;
  mode?: "retry" | "support_only";
  onRetry?: () => void;
};

type PartnerUiContextValue = {
  showError: (state: ErrorState) => void;
  showToast: (message: string) => void;
};

const PartnerUiContext = createContext<PartnerUiContextValue | null>(null);

export function PartnerUiProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState<ErrorState | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showError = useCallback((state: ErrorState) => {
    setError(state);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  const value = useMemo(
    () => ({ showError, showToast }),
    [showError, showToast],
  );

  return (
    <PartnerUiContext.Provider value={value}>
      {children}
      <PartnerErrorModal
        open={Boolean(error)}
        message={error?.message}
        mode={error?.mode ?? "retry"}
        onClose={() => setError(null)}
        onRetry={
          error?.onRetry ??
          (() => {
            router.refresh();
          })
        }
      />
      <CopyToast message={toast} onDismiss={() => setToast(null)} />
    </PartnerUiContext.Provider>
  );
}

export function usePartnerUi(): PartnerUiContextValue {
  const ctx = useContext(PartnerUiContext);
  if (!ctx) {
    throw new Error("usePartnerUi must be used within PartnerUiProvider");
  }
  return ctx;
}

/** Safe optional hook for components that may render outside the app shell. */
export function usePartnerUiOptional(): PartnerUiContextValue | null {
  return useContext(PartnerUiContext);
}
