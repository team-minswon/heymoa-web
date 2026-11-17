"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ChatDeleteDialog({
  target,
  onOpenChange,
  onConfirm,
}: {
  target: { chatId: string; title: string } | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (chatId: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const t = useTranslations("chat.deleteDialog");
  const tActions = useTranslations("common.actions");

  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription
            render={<div />}
            className="space-y-3 text-left"
          >
            <p className="break-words font-medium text-foreground">
              {target?.title}
            </p>
            <p>{t("description")}</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{tActions("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            loading={busy}
            disabled={busy || target === null}
            onClick={async () => {
              if (!target) return;
              setBusy(true);
              const deleted = await onConfirm(target.chatId);
              setBusy(false);
              if (deleted) onOpenChange(false);
            }}
          >
            {tActions("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
