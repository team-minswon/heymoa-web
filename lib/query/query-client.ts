import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/ui/toast";

import { errorCodeOf, errorMessageOf } from "@/lib/api/error-message";
import { ApiError, isAuthError } from "@/lib/api/fetcher";
import { isSessionExpired } from "@/lib/auth/session-gate";

/** 재시도로 기다려 줄 최대 시간. v5 기본 백오프의 상한과 같다. */
const MAX_RETRY_AFTER_MS = 30_000;

/**
 * mutation이 실패하면 기본으로 토스트를 띄운다.
 *
 * 실패를 화면에 인라인으로 그리면 레이아웃이 흔들린다 — 방금 누른 버튼 옆에 문구가
 * 끼어들면서 아래가 밀린다. mutation 실패는 **사용자가 방금 한 행동에 대한 응답**이라
 * 사라져도 되므로 토스트가 맞다.
 *
 * `meta.suppressErrorToast: true`면 건너뛴다. 이유는 둘이다.
 *
 * 1. **화면이 인라인으로 그린다** — 지속 상태(입력 잠금, 회의 비ACTIVE, 승인 카드 무효화)와
 *    주 데이터 실패(노트 404, 분석 FAILED, 끊긴 스트림). 판정 기준은
 *    `.claude/rules/error-loading.md`에 있다
 * 2. **호출부가 이미 자기 토스트를 띄운다** — 실패 코드에 따라 문구가 갈리는 곳
 *    (프로젝트 삭제의 "노트가 있어 삭제할 수 없습니다" 등). 여기서 또 띄우면 두 개가 겹친다
 *
 * 화면이 **일부 코드만** 인라인으로 그리면 `true` 대신 그 코드 목록을 준다. 목록의 코드만 건너뛰고
 * 나머지 실패는 그대로 토스트로 띄운다(개인 토큰 발급의 `AGENT_ACCESS_DISABLED`, APP-941).
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        // 호출부 31곳 중 retry를 지정한 곳이 2곳뿐이라 나머지는 v5 기본값 3회를 쓴다.
        // 인증 오류는 몇 번을 더 보내도 결과가 같으므로 여기서 끊는다.
        retry: (failureCount, error) => {
          if (isAuthError(error)) return false;
          if (error instanceof ApiError && error.status === 429) {
            // 언제 풀릴지 아는 짧은 제한만 한 번 기다린다. 모르거나 길면 화면을 붙잡아 두지 않는다
            return (
              failureCount < 1 &&
              error.retryAfterMs != null &&
              error.retryAfterMs <= MAX_RETRY_AFTER_MS
            );
          }
          // 4xx 는 다시 보내도 답이 같다 — 오류만 늦게 보인다 (APP-783)
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
      onError: (error, _variables, _context, mutation) => {
        const suppress = mutation.meta?.suppressErrorToast;
        if (suppress === true) return;
        if (Array.isArray(suppress) && suppress.includes(errorCodeOf(error)))
          return;
        // 세션이 끝난 뒤의 실패는 만료 토스트 하나로 충분하다. 여기서 또 띄우면
        // "세션이 만료되었습니다"와 "요청을 처리하지 못했습니다"가 겹친다.
        if (isSessionExpired() || isAuthError(error)) return;
        toast.error(errorMessageOf(error, "요청을 처리하지 못했습니다."));
      },
    }),
  });
}
