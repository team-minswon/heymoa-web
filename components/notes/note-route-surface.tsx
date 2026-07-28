"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
  if (view === "side") {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          aria-label="노트"
          data-surface="sheet"
          showCloseButton={false}
          className="inset-0 h-dvh w-full max-w-none gap-0 overflow-hidden rounded-none border-0 bg-white p-0 shadow-e3 sm:max-w-none md:inset-y-2 md:left-auto md:right-2 md:h-[calc(100dvh-1rem)] md:w-[min(860px,calc(100vw-15rem))] md:max-w-[860px] md:rounded-panel md:border md:border-black/5"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>노트</SheetTitle>
            <SheetDescription>선택한 회의 노트 상세</SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    // 상단바 아래 전부가 이 면의 몫이다. 셸 컨테이너가 뷰포트 높이에 못박혀 있어(APP-252)
    // `bottom-0`이 곧 화면 바닥이다 — 상단바 높이를 여기 다시 적지 않는다.
    <div
      data-surface="full"
      className="absolute inset-x-0 bottom-0 top-16 z-10 min-h-0 overflow-hidden bg-background"
    >
      {children}
    </div>
  );
}
