"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  workspaceId,
  view,
  children,
}: {
  workspaceId: string;
  view: NoteViewMode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const surface = resolveNoteSurface(view, isDesktop);
  const [isOpen, setIsOpen] = useState(true);

  const close = () => {
    setIsOpen(false);
    // Give a tiny tick for the state to update before navigating
    setTimeout(() => {
      router.push(`/w/${workspaceId}`);
    }, 50);
  };

  if (surface === "sheet") {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent
          aria-label="노트"
          data-surface="sheet"
          showCloseButton={false}
          className="gap-0 p-0 !bg-card md:!right-2 md:!top-2 md:!bottom-2 md:!h-[calc(100svh-16px)] md:!rounded-xl md:!border md:shadow-xl md:!overflow-hidden"
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
      <Drawer open={isOpen} onOpenChange={(open) => !open && close()} showSwipeHandle>
        <DrawerContent
          aria-label="노트"
          data-surface="drawer"
          className="[--drawer-content-max-height:calc(100dvh-3rem)]"
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
