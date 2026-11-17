"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("notes.surface");
  const isFull = view === "full";
  const [hasOpened, setHasOpened] = useState(isOpen);
  if (isOpen && !hasOpened) setHasOpened(true);
  return (
    <>
      {isFull && !hasOpened ? <NoteFullSkeleton /> : null}
      <Sheet
        open={isOpen}
        modal={!isFull}
        disablePointerDismissal={isFull}
        onOpenChange={(open) => !open && !isFull && onClose()}
      >
        <SheetContent
          aria-label={t("label")}
          data-surface={isFull ? "full" : "sheet"}
          side="none"
          showCloseButton={false}
          overlayClassName={isFull ? "hidden" : undefined}
          className={cn(
            "inset-0 min-h-0 w-full max-w-none gap-0 overflow-hidden border-0 p-0 sm:max-w-none transition-opacity motion-reduce:transition-none",
            isFull
              ? "z-30 block h-dvh bg-[var(--el-canvas)] p-2.5 shadow-none"
              : "h-dvh rounded-none bg-white shadow-e3 md:inset-y-2 md:left-auto md:right-2 md:h-[calc(100dvh-1rem)] md:w-[min(860px,calc(100vw-15rem))] md:max-w-[860px] md:rounded-panel md:border md:border-[var(--el-hairline)]"
          )}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("label")}</SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
          </SheetHeader>
          {children}
        </SheetContent>
      </Sheet>
    </>
  );
}
