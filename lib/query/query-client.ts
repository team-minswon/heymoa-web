import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/ui/toast";

import { trackMutation } from "@/lib/analytics/track";
import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { ApiError, isAuthError } from "@/lib/api/fetcher";
import { isSessionExpired } from "@/lib/auth/session-gate";
import { webMessage } from "@/lib/i18n/web-message";

const MAX_RETRY_AFTER_MS = 30_000;

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isAuthError(error)) return false;
          if (error instanceof ApiError && error.status === 429) {
            return (
              failureCount < 1 &&
              error.retryAfterMs != null &&
              error.retryAfterMs <= MAX_RETRY_AFTER_MS
            );
          }
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
        retryDelay: (failureCount, error) =>
          error instanceof ApiError &&
          error.status === 429 &&
          error.retryAfterMs != null
            ? error.retryAfterMs
            : Math.min(1000 * 2 ** failureCount, MAX_RETRY_AFTER_MS),
      },
    },
    mutationCache: new MutationCache({
      onSuccess: (_data, variables, _context, mutation) =>
        trackMutation(mutation.options.mutationKey?.[0], variables),
      onError: (error, _variables, _context, mutation) => {
        const suppress = mutation.meta?.suppressErrorToast;
        if (suppress === true) return;
        if (Array.isArray(suppress) && suppress.includes(errorCodeOf(error)))
          return;
        if (isSessionExpired() || isAuthError(error)) return;
        toast.error(errorMessageOf(error, webMessage("requestFailed")));
      },
    }),
  });
}
