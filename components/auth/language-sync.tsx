"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useUpdateCurrentUser } from "@/lib/api/generated/users/users";
import type { AuthUser } from "@/lib/auth/types";
import { decideLanguageSync } from "@/lib/i18n/account-sync";
import { readLocaleCookie, writeLocaleCookie } from "@/lib/i18n/cookie";
import { trackInitialLanguageSave } from "@/lib/i18n/initial-language-save";
import { isLocale } from "@/lib/i18n/locales";

/** 테스트가 바꿔 끼운다. jsdom 의 `location.reload` 는 바꿀 수 없다. */
export const reloadForAccountLanguage = {
  run: () => window.location.reload(),
};

export function LanguageSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const screen = useLocale();
  const done = useRef(false);
  const { mutateAsync } = useUpdateCurrentUser({
    mutation: { meta: { suppressErrorToast: true } },
  });

  useEffect(() => {
    if (done.current || !user || !isLocale(screen)) return;
    done.current = true;

    const action = decideLanguageSync({
      account: user.language,
      cookie: readLocaleCookie(),
      screen,
    });
    if (action.cookie) writeLocaleCookie(action.cookie);
    if (user.language && user.language !== screen) {
      reloadForAccountLanguage.run();
      return;
    }
    if (action.account) {
      const language = action.account;
      trackInitialLanguageSave(mutateAsync({ data: { language } }))
        .then(() => {
          queryClient.setQueryData<AuthUser | null>(["user"], (current) =>
            current ? { ...current, language } : current
          );
        })
        .catch(() => undefined);
    }
  }, [user, screen, mutateAsync, queryClient]);

  return null;
}
