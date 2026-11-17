"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cardChangeFramePath,
  cardChangeFrameSkeleton,
  cardEntryEventOf,
} from "@/lib/billing/card-entry-frame";
import { goToSetupResult } from "@/lib/billing/navigate";
import { invalidateWorkspaceBilling } from "@/lib/billing/queries";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/utils";

export function CardChangeDialog({
  workspaceId,
  open,
  register,
  onClose,
}: {
  workspaceId: string;
  open: boolean;
  register: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("billing.checkout");
  const queryClient = useQueryClient();
  const submittingRef = useRef(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submittingRef.current) onClose();
      }}
    >
      <DialogContent
        className="ph-no-capture content-start gap-5 overflow-y-auto p-6 data-closed:animate-none sm:max-h-[calc(100dvh-2rem)] sm:max-w-[480px] max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:p-5 max-sm:ring-0"
        overlayClassName="data-closed:animate-none"
      >
        {open ? (
          <CardChangeFrame
            workspaceId={workspaceId}
            title={register ? t("replace.register.title") : t("replace.title")}
            register={register}
            submittingRef={submittingRef}
            onEscape={() => {
              if (!submittingRef.current) onClose();
            }}
            onChanged={() => {
              onClose();
              void invalidateWorkspaceBilling(queryClient, workspaceId);
              toast.success(
                register ? t("replace.registered") : t("replace.changed")
              );
            }}
            onResult={(setupId) => {
              onClose();
              goToSetupResult(setupId);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CardChangeFrame({
  workspaceId,
  title,
  register,
  submittingRef,
  onEscape,
  onChanged,
  onResult,
}: {
  workspaceId: string;
  title: string;
  register: boolean;
  submittingRef: RefObject<boolean>;
  onEscape: () => void;
  onChanged: () => void;
  onResult: (setupId: string) => void;
}) {
  const t = useTranslations("billing.checkout");
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const escape = useEffectEvent(onEscape);
  const changed = useEffectEvent(onChanged);
  const result = useEffectEvent(onResult);

  useEffect(() => {
    submittingRef.current = false;
    const onMessage = (event: MessageEvent) => {
      const message = cardEntryEventOf(event, frame.current);
      if (!message) return;
      if (message.event === "height") setHeight(message.height);
      else if (message.event === "submitting")
        submittingRef.current = message.submitting;
      else if (message.event === "escape") escape();
      else {
        submittingRef.current = false;
        if (message.event === "changed") changed();
        else result(message.setupId);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      submittingRef.current = false;
    };
  }, [submittingRef]);

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle className="text-lg text-balance">{title}</DialogTitle>
      </DialogHeader>
      <div className="relative">
        {height === null ? (
          <Skeleton
            aria-label={t("replace.loading")}
            className={cardChangeFrameSkeleton(register)}
          />
        ) : null}
        <iframe
          ref={frame}
          src={cardChangeFramePath(workspaceId)}
          title={title}
          referrerPolicy="no-referrer"
          allow=""
          className={cn(
            "block w-full border-0",
            height === null && "absolute inset-x-0 top-0 h-0"
          )}
          style={height === null ? undefined : { height }}
        />
      </div>
    </>
  );
}
