"use client";

import * as React from "react";
import Image from "next/image";

import { GoogleLoginButton } from "@/components/auth/google-login-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { siteConfig } from "@/lib/site";

interface AuthModalProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AuthModal({ children, open, onOpenChange }: AuthModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && (
        <DialogTrigger
          render={
            React.isValidElement(children) ? (
              children
            ) : (
              <button type="button">{children}</button>
            )
          }
        />
      )}
      <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl border-[var(--el-hairline)] bg-[var(--el-canvas)] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-0 overflow-hidden">
        <div className="flex flex-col items-center px-6 py-10 sm:px-12 sm:py-14 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--el-hairline)] bg-[var(--el-surface-card)] shadow-sm">
            <Image
              src="/apple-touch-icon.png"
              alt={siteConfig.name}
              width={40}
              height={40}
              className="rounded-full object-contain"
              priority
            />
          </div>

          <DialogHeader className="mb-8 w-full text-center">
            <DialogTitle className="font-serif text-2xl font-light tracking-[-0.02em] text-[var(--el-ink)] sm:text-3xl mx-auto">
              Welcome to HeyMoa
            </DialogTitle>
            <DialogDescription className="mt-2 text-[15px] font-normal text-[var(--el-body)] mx-auto">
              회의를 기록하고 참여하며, 대화를 실제 업무로 연결하는 AI
              에이전트를 시작해보세요.
            </DialogDescription>
          </DialogHeader>

          <div className="w-full max-w-sm">
            <GoogleLoginButton className="w-full flex justify-center [&>button]:w-full" />
            <p className="mt-6 text-xs text-[var(--el-muted)]">
              계속 진행하면 HeyMoa의{" "}
              <a href="/terms" className="underline hover:text-[var(--el-ink)]">
                서비스 이용약관
              </a>
              과{" "}
              <a
                href="/privacy"
                className="underline hover:text-[var(--el-ink)]"
              >
                개인정보 처리방침
              </a>
              에 동의하는 것으로 간주됩니다.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
