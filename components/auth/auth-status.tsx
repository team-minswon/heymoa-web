"use client";

import { useTranslations } from "next-intl";

import { useAuth } from "@/components/auth/auth-provider";
import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { isAuthApiConfigured } from "@/lib/auth/paths";

export function AuthStatus() {
  const { user, status } = useAuth();
  const t = useTranslations("auth.status");

  if (status === "checking") {
    return (
      <Button
        type="button"
        variant="outline"
        size="xl"
        loading
        disabled
        aria-label={t("checking")}
        className="rounded-full font-medium"
      >
        {t("signIn")}
      </Button>
    );
  }

  if (status === "authenticated" && user) {
    return null;
  }

  if (!isAuthApiConfigured) {
    return (
      <Button
        type="button"
        variant="outline"
        size="xl"
        className="rounded-full font-medium"
        disabled
      >
        {t("signIn")}
      </Button>
    );
  }

  // 브레이크포인트마다 같은 버튼을 두 벌 두던 자리였다 — 렌더 결과가 같아 AuthModal만
  // 두 번 생겼다. 하나로 합친다.
  return (
    <AuthModal>
      <Button variant="outline" size="xl" className="rounded-full font-medium">
        {t("signIn")}
      </Button>
    </AuthModal>
  );
}
