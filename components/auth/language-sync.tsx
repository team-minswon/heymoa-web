"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useUpdateCurrentUser } from "@/lib/api/generated/users/users";
import { decideLanguageSync } from "@/lib/i18n/account-sync";
import { readLocaleCookie, writeLocaleCookie } from "@/lib/i18n/cookie";
import { isLocale } from "@/lib/i18n/locales";

/**
 * 로그인한 제품 화면이 처음 뜬 뒤 계정과 언어 쿠키를 **문서마다 한 번** 맞춘다(APP-1285). 판정은 `decideLanguageSync`.
 *
 * 제품 루트(`app/(product)/layout.tsx`)에만 둔다. 마케팅 면의 언어는 주소가 정하므로 `/en` 랜딩에 들어온 것을 고른
 * 것으로 치면 안 된다. 계정 저장이 실패해도 화면은 이미 그 언어라 알리지 않는다 — 사용자가 한 행동이 아니고, 다음
 * 문서에서 다시 시도한다.
 */
export function LanguageSync() {
  const { user, setUser } = useAuth();
  const screen = useLocale();
  const done = useRef(false);
  const { mutate } = useUpdateCurrentUser({
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
    if (action.account) {
      const language = action.account;
      mutate(
        { data: { language } },
        { onSuccess: () => setUser({ ...user, language }) }
      );
    }
  }, [user, screen, mutate, setUser]);

  return null;
}
