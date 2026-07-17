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
          className="inset-0 h-dvh w-full max-w-none gap-0 overflow-hidden rounded-none border-0 bg-white p-0 shadow-[-12px_0_48px_rgba(12,10,9,0.12)] sm:max-w-none md:inset-y-2 md:left-auto md:right-2 md:h-[calc(100dvh-1rem)] md:w-[min(860px,calc(100vw-15rem))] md:max-w-[860px] md:rounded-[22px] md:border md:border-black/5"
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
    <div
      data-surface="full"
      className="absolute inset-x-0 bottom-0 top-16 z-10 min-h-0 bg-background"
    >
      {children}
    </div>
  );
}
