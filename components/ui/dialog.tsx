"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      // 다른 대화상자(노트 시트) 위에 겹쳐 열릴 때도 배경을 어둡게 그린다. 안 그러면 Base UI 가
      // 중첩 대화상자의 배경을 안 그려 사이드 뷰에서 확인창 뒤가 그대로 보인다(알림 대화상자도 같다).
      forceRender
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * 닫힌 뒤 포커스는 열기 전 자리(보통 트리거)로 돌려주되, **그 자리가 열 때 링을 보이고 있었을 때만 링도 돌려준다.**
 *
 * 마우스로 트리거를 누르면 포커스는 가지만 `:focus-visible` 은 꺼져 있다. 그런데 Esc 로 닫으면 브라우저는 마지막
 * 조작을 키보드로 보고, 돌아온 포커스에 링을 켠다 — 마우스로 연 사이드바 「알림」에 검은 테두리가 남던 원인이다.
 * 닫는 방식(`closeType`)이 아니라 **여는 순간의 상태**로 판정해야 키보드 사용자에게는 링이, 마우스 사용자에게는
 * 조용한 복귀가 간다. `focusVisible: false` 를 모르는 브라우저는 예전처럼 링을 그린다(퇴행 없음).
 */
type OpenType = Parameters<
  Extract<DialogPrimitive.Popup.Props["initialFocus"], (type: never) => unknown>
>[0];

function useReturnFocus({
  initialFocus,
  finalFocus,
}: Pick<DialogPrimitive.Popup.Props, "initialFocus" | "finalFocus">) {
  const opener = React.useRef<{ el: HTMLElement; ring: boolean } | null>(null);
  if (finalFocus !== undefined) return { initialFocus, finalFocus };
  return {
    initialFocus: (openType: OpenType) => {
      const el = document.activeElement;
      opener.current =
        el instanceof HTMLElement && el !== document.body
          ? { el, ring: el.matches(":focus-visible") }
          : null;
      if (typeof initialFocus === "function") return initialFocus(openType);
      if (initialFocus && typeof initialFocus === "object")
        return initialFocus.current ?? true;
      return initialFocus ?? true;
    },
    finalFocus: () => {
      const from = opener.current;
      opener.current = null;
      if (!from || from.ring || !from.el.isConnected) return true;
      // `focusVisible` 은 lib.dom 에 아직 없다(Chromium·Firefox 지원).
      from.el.focus({
        preventScroll: true,
        focusVisible: false,
      } as FocusOptions);
      return false;
    },
  };
}

function DialogContent({
  className,
  overlayClassName,
  children,
  showCloseButton = true,
  initialFocus,
  finalFocus,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  /** 배경 막(오버레이)에 덧입히는 클래스. 기본 오버레이는 `backdrop-blur` 가 닫힐 때 서서히 풀리지 않고 뚝 끊긴다. */
  overlayClassName?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-panel bg-popover p-4 text-sm text-popover-foreground shadow-e3 ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...useReturnFocus({ initialFocus, finalFocus })}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">닫기</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-panel border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
