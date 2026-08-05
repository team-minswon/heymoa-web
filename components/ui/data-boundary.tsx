"use client";

import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { InlineRetry } from "@/components/ui/inline-retry";

/**
 * 조회 위젯의 공용 경계. 로딩은 fallback(skeleton), 실패는 InlineRetry("다시 시도"→재요청).
 * TanStack Query 공식 Suspense 패턴: QueryErrorResetBoundary.reset을 ErrorBoundary.onReset에 연결.
 * useSuspenseQuery를 쓰는 자식에만 의미가 있다. mutation 실패는 여기 오지 않는다(토스트 담당).
 */
export function DataBoundary({
  fallback,
  children,
  errorLabel,
  resetKeys,
  renderError,
}: {
  fallback: React.ReactNode;
  children: React.ReactNode;
  errorLabel?: string;
  // 감싼 리소스(noteId·workspaceId·설정 섹션 등)의 식별자. 리소스가 바뀌면 잡아 둔 에러를
  // 자동으로 푼다 — 없으면 같은 위치의 다른 리소스로 전환해도 이전 에러 화면이 잔류한다.
  resetKeys?: unknown[];
  /**
   * 특정 실패만 다르게 그려야 할 때 넘긴다. **`null`을 돌려주면 기본 `InlineRetry`로
   * 떨어진다** — 코드 하나만 가로채고 나머지는 공용 처리에 맡기라는 뜻이다.
   *
   * 재시도가 성공할 수 없는 실패에만 쓴다(예: 추방당한 워크스페이스의 404). 대부분의
   * 실패는 재시도가 맞으므로 이 prop 없이 두는 것이 기본이다.
   */
  renderError?: (error: unknown) => React.ReactNode | null;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={resetKeys}
          fallbackRender={({ error, resetErrorBoundary }) =>
            renderError?.(error) ?? (
              <InlineRetry onRetry={resetErrorBoundary} label={errorLabel} />
            )
          }
        >
          <Suspense fallback={fallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
