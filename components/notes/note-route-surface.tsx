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
    // 높이를 뷰포트에서 받는다. `bottom-0`이면 뒤에 깔린 워크스페이스 목록이 길어질수록
    // 이 면도 같이 늘어나 레코더 독과 챗 입력창이 화면 밖으로 밀린다(노트 10개에서 실측).
    // 상단바 64를 뺀 나머지가 이 면의 몫이다.
    <div
      data-surface="full"
      className="absolute inset-x-0 top-16 z-10 h-[calc(100svh-4rem)] min-h-0 overflow-hidden bg-background"
    >
      {children}
    </div>
  );
}
