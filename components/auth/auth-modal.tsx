"use client";

import * as React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { ConsentCheckbox } from "@/components/auth/consent-checkbox";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { rememberLoginConsent } from "@/lib/auth/login-consent";
import { siteConfig } from "@/lib/site";

interface AuthModalProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * 로그인 버튼과 약관 동의(APP-1277). **체크하기 전에는 버튼이 눌리지 않는다.** 창이 열릴 때마다 새로 마운트되어
 * 닫았다 열면 체크가 풀린다 — 동의는 로그인할 때마다 직접 한다.
 */
export function LoginForm() {
  const t = useTranslations("auth.consent");
  const [agreed, setAgreed] = React.useState(false);

  return (
    <div className="w-full max-w-sm">
      <GoogleLoginButton
        className="w-full flex justify-center [&>button]:w-full"
        disabled={!agreed}
        onLoginStart={rememberLoginConsent}
      />
      <div className="mt-5">
        <ConsentCheckbox
          checked={agreed}
          onCheckedChange={setAgreed}
          hint={t("requiredToLogin")}
        />
      </div>
    </div>
  );
}

export function AuthModal({ children, open, onOpenChange }: AuthModalProps) {
  const t = useTranslations("auth.login");

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
            <DialogTitle className="text-2xl font-light tracking-[-0.02em] text-[var(--el-ink)] sm:text-3xl mx-auto">
              {t("title")}
            </DialogTitle>
            <DialogDescription className="mt-2 text-[15px] font-normal text-[var(--el-body)] mx-auto">
              {t("description")}
            </DialogDescription>
          </DialogHeader>

          <LoginForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}
