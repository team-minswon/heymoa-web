"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { toast } from "@/lib/ui/toast";

const KEY = "heymoa:account-deleted";

/** 탈퇴 직후 홈으로 보내기 전에 부른다. 이동은 문서째 바뀌어서 안내를 sessionStorage 로 넘긴다. */
export function markAccountDeleted() {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // 저장소를 못 쓰면 안내만 빠진다 — 탈퇴는 이미 끝났다.
  }
}

/** 탈퇴하고 홈에 닿으면 짧은 완료 토스트를 한 번 띄운다(PRO-69, APP-1383). */
export function AccountDeletedNotice() {
  const t = useTranslations("auth.accountDeleted");
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(KEY) !== "1") return;
      window.sessionStorage.removeItem(KEY);
    } catch {
      return;
    }
    toast.success(t("title"), { description: t("description") });
  }, [t]);
  return null;
}
