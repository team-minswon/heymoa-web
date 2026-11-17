"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { toast } from "@/lib/ui/toast";

const KEY = "heymoa:account-deleted";

export function markAccountDeleted() {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {}
}

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
