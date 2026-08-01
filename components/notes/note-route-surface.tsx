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
          aria-label="회의"
          data-surface="sheet"
          showCloseButton={false}
          // 넓은 화면에서는 캔버스에서 10 띄운 패널이다 — 셸 패널·에이전트 레일과 같은
          // 여백·radius·테두리라야 셋이 한 판 위에 놓인 것으로 읽힌다.
          className="inset-0 h-dvh w-full max-w-none gap-0 overflow-hidden rounded-none border-0 bg-card p-0 shadow-e3 sm:max-w-none md:inset-y-2.5 md:right-2.5 md:left-auto md:h-[calc(100dvh-20px)] md:w-[min(860px,calc(100vw-15rem))] md:max-w-[860px] md:rounded-panel md:border md:border-[var(--el-hairline)]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>회의</SheetTitle>
            <SheetDescription>선택한 회의 상세</SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    // full 회의는 패널을 통째로 쓴다 — 셸이 사이드바와 상단바를 걷었으므로 남길 여백이 없다.
    // 셸 컨테이너가 뷰포트 높이에 못박혀 있어(APP-252) inset-0 이 곧 화면이다.
    <div
      data-surface="full"
      className="absolute inset-0 z-10 min-h-0 overflow-hidden bg-card"
    >
      {children}
    </div>
  );
}
