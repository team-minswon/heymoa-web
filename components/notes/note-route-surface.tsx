"use client";

import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NoteFullSkeleton } from "@/components/notes/note-full-skeleton";
import { cn } from "@/lib/utils";

export type NoteViewMode = "side" | "full";

export function NoteRouteSurface({
  view,
  isOpen,
  onClose,
  children,
}: {
  view: NoteViewMode;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const isFull = view === "full";
  const [hasOpened, setHasOpened] = useState(isOpen);
  if (isOpen && !hasOpened) setHasOpened(true);
  return (
    <>
      {/* 포털은 클라이언트에서 붙는다. 전체 뷰 직링크는 그동안 같은 형태의 골격을 보인다. */}
      {isFull && !hasOpened ? <NoteFullSkeleton /> : null}
      {/* 같은 포털·본문을 유지하고 기하만 바꾼다. 조회 구독·스크롤·편집 상태는 살아 있다.
          전체 뷰는 가려진 셸의 inert 정책을 쓰며, 기록 상태 필과 중첩 창을 막지 않는다. */}
      <Sheet
        open={isOpen}
        modal={!isFull}
        disablePointerDismissal={isFull}
        onOpenChange={(open) => !open && !isFull && onClose()}
      >
        <SheetContent
          aria-label="노트"
          data-surface={isFull ? "full" : "sheet"}
          side="none"
          showCloseButton={false}
          overlayClassName={isFull ? "hidden" : undefined}
          className={cn(
            // 뷰 전환의 배경·그림자는 즉시 바꾸고, 열기·닫기의 투명도만 전환한다.
            "inset-0 min-h-0 w-full max-w-none gap-0 overflow-hidden border-0 p-0 sm:max-w-none transition-opacity motion-reduce:transition-none",
            isFull
              ? "z-30 block h-dvh bg-[var(--el-canvas)] p-2.5 shadow-none"
              : "h-dvh rounded-none bg-white shadow-e3 md:inset-y-2 md:left-auto md:right-2 md:h-[calc(100dvh-1rem)] md:w-[min(860px,calc(100vw-15rem))] md:max-w-[860px] md:rounded-panel md:border md:border-[var(--el-hairline)]"
          )}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>노트</SheetTitle>
            <SheetDescription>선택한 회의 노트 상세</SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    </>
  );
}
