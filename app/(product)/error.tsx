"use client";

import { ErrorView } from "@/components/layout/error-view";

/** 제품 면은 한국어만이다(주소에 언어가 없다). */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView locale="ko" reset={reset} />;
}
