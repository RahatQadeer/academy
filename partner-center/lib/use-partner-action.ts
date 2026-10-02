"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  isSessionExpiredMessage,
  sessionExpiredRedirectPath,
} from "@/partner-center/lib/session-errors";
import { usePartnerUi } from "@/partner-center/components/PartnerUiProvider";

type ActionResult = { error?: string; ok?: boolean };

export function usePartnerAction() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showError } = usePartnerUi();

  const handleSessionExpired = useCallback(() => {
    const search = searchParams.toString();
    const next = sessionExpiredRedirectPath(pathname, search);
    router.replace(next);
  }, [pathname, router, searchParams]);

  const runAction = useCallback(
    async <T extends ActionResult>(
      action: () => Promise<T>,
      options?: {
        onValidationError?: (message: string) => void;
        supportOnly?: boolean;
        onRetry?: () => void;
      },
    ): Promise<T> => {
      try {
        const result = await action();
        if (result.error) {
          if (isSessionExpiredMessage(result.error)) {
            handleSessionExpired();
            return result;
          }
          if (options?.onValidationError) {
            options.onValidationError(result.error);
            return result;
          }
          showError({
            message: result.error,
            mode: options?.supportOnly ? "support_only" : "retry",
            onRetry: options?.onRetry,
          });
        }
        return result;
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : "Something went wrong.";
        if (isSessionExpiredMessage(message)) {
          handleSessionExpired();
          return { error: message } as T;
        }
        showError({
          message,
          mode: options?.supportOnly ? "support_only" : "retry",
          onRetry: options?.onRetry,
        });
        return { error: message } as T;
      }
    },
    [handleSessionExpired, showError],
  );

  return { runAction, handleSessionExpired };
}
