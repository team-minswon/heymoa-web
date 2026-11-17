"use client";

import { useCallback, useEffect, useRef } from "react";

import { CheckoutForm } from "@/components/billing/billing-checkout";
import { DataBoundary } from "@/components/ui/data-boundary";
import { postToCardEntryParent } from "@/lib/billing/card-entry-frame";

export function CardChangeFrame({ workspaceId }: { workspaceId: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
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
