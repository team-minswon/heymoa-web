"use client";

import { useCallback, useEffect, useRef } from "react";

import { CheckoutForm } from "@/components/billing/billing-checkout";
import { DataBoundary } from "@/components/ui/data-boundary";
import { postToCardEntryParent } from "@/lib/billing/card-entry-frame";

/**
 * `/billing/card-change/{workspaceId}` — 카드 변경 모달(`CardChangeDialog`) 안 iframe 의 문서(APP-1600). 분석 없는 문서에서
 * 요약·카드·동의를 받고 등록을 열어 카드를 낸다. 부모(설정 창)는 카드 값도 동의 상태도 모르고 열고 닫기만 한다 —
 * 높이·진행·결과만 `postMessage` 로 알린다. 등록을 읽는 동안은 비워 두고(높이 0 은 알리지 않는다) 모달이 자리를 잡는다.
 */
export function CardChangeFrame({ workspaceId }: { workspaceId: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // 모달이 iframe 높이를 내용에 맞추게 알린다(스크롤 한 겹). 오류 문구가 나타나면 따라 늘어난다.
    const observer = new ResizeObserver(() => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height > 0) postToCardEntryParent({ event: "height", height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // iframe 에 포커스가 있으면 Esc 가 부모 문서로 가지 않는다 — 대신 알린다.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") postToCardEntryParent({ event: "escape" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSubmittingChange = useCallback(
    (submitting: boolean) =>
      postToCardEntryParent({ event: "submitting", submitting }),
    []
  );

  return (
    <div ref={root}>
      <DataBoundary resetKeys={[workspaceId]} fallback={null}>
        <CheckoutForm
          workspaceId={workspaceId}
          purpose="REPLACE"
          onResult={(setupId) =>
            postToCardEntryParent({ event: "result", setupId })
          }
          onChanged={() => postToCardEntryParent({ event: "changed" })}
          onSubmittingChange={onSubmittingChange}
        />
      </DataBoundary>
    </div>
  );
}
