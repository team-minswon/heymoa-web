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
}: {
  fallback: React.ReactNode;
  children: React.ReactNode;
  errorLabel?: string;
  // 감싼 리소스(noteId·workspaceId·설정 섹션 등)의 식별자. 리소스가 바뀌면 잡아 둔 에러를
  // 자동으로 푼다 — 없으면 같은 위치의 다른 리소스로 전환해도 이전 에러 화면이 잔류한다.
  resetKeys?: unknown[];
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={resetKeys}
          fallbackRender={({ resetErrorBoundary }) => (
            <InlineRetry onRetry={resetErrorBoundary} label={errorLabel} />
          )}
        >
          <Suspense fallback={fallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
