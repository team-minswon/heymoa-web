"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

export type NoteViewMode = "side" | "full";
export type NoteSurface = "sheet" | "drawer" | "full";

export function resolveNoteSurface(
  view: NoteViewMode,
  isDesktop: boolean
): NoteSurface {
  if (view === "full") return "full";
  return isDesktop ? "sheet" : "drawer";
}

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
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const surface = resolveNoteSurface(view, isDesktop);

  if (surface === "sheet") {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          aria-label="노트"
          data-surface="sheet"
          showCloseButton={false}
          className="inset-y-3 right-3 h-[calc(100dvh-1.5rem)] gap-0 overflow-hidden rounded-2xl border border-[var(--el-hairline)] bg-white p-0 shadow-[0_12px_36px_rgba(0,0,0,0.10)]"
          style={{
            width: "min(780px, calc(100vw - 16rem))",
            maxWidth: "780px",
          }}
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

  if (surface === "drawer") {
    return (
      <Drawer
        open={isOpen}
        onOpenChange={(open) => !open && onClose()}
        showSwipeHandle
      >
        <DrawerContent
          aria-label="노트"
          data-surface="drawer"
          className="[--drawer-content-max-height:100dvh] min-h-dvh rounded-none"
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>노트</DrawerTitle>
            <DrawerDescription>선택한 회의 노트 상세</DrawerDescription>
          </DrawerHeader>
          {children}
        </DrawerContent>
      </Drawer>
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
