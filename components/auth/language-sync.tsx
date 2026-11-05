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

/**
 * 로그인한 제품 화면이 처음 뜬 뒤 계정과 언어 쿠키를 **문서마다 한 번** 맞춘다(APP-1285). 판정은 `decideLanguageSync`.
 *
 * 제품 루트(`app/(product)/layout.tsx`)에만 둔다. 마케팅 면의 언어는 주소가 정하므로 `/en` 랜딩에 들어온 것을 고른
 * 것으로 치면 안 된다. 계정 저장이 실패해도 화면은 이미 그 언어라 알리지 않는다 — 사용자가 한 행동이 아니고, 다음
 * 문서에서 다시 시도한다.
 *
 * - 저장은 `trackInitialLanguageSave` 에 걸어 둔다. 설정의 언어 탭이 이것이 끝난 뒤에 저장해야, 늦게 닿은 초기값이
 *   방금 고른 언어를 되돌리지 않는다.
 * - SSR 이 계정을 놓치고(세션 조회 일시 실패·`refresh_required`) 클라이언트가 계정을 되찾으면, 화면은 쿠키·브라우저
 *   언어로 그려져 계정과 다를 수 있다. 그때는 쿠키를 계정 값으로 쓰고 **한 번** 새로 연다. 새 문서는 SSR 이 또 계정을
 *   놓쳐도 그 쿠키로 같은 언어를 그리므로 다시 새로 열지 않는다.
 */
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
          // 그사이 바뀐 사용자 정보를 덮지 않게 언어만 고친다.
          queryClient.setQueryData<AuthUser | null>(["user"], (current) =>
            current ? { ...current, language } : current
          );
        })
        .catch(() => undefined);
    }
  }, [user, screen, mutateAsync, queryClient]);

  return null;
}
