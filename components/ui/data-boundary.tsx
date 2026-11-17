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
  resetKeys?: unknown[];
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
