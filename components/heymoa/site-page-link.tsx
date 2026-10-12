"use client";

import type { ComponentProps } from "react";
import Link from "next/link";

import { useDesktopApp } from "@/lib/desktop/use-desktop-app";

/**
 * 제품 화면에서 우리 사이트의 다른 페이지(`/help`·`/privacy` 등)로 가는 글자 링크. 브라우저에서는 **새 탭으로
 * 연다** — 보던 회의나 설정 창을 잃지 않게.
 *
 * **데스크톱 앱에서는 앱 안에서 이동한다.** 앱은 새 창 요청을 막고 외부 브라우저로 넘기는데
 * (`apps/desktop/src/security.ts`), 같은 사이트 주소는 넘기지 않는다(`policy.ts`의 `externalUrl`) — 새 탭으로
 * 열면 앱에서는 아무 일도 안 일어났다(codex 리뷰). 앱인지는 하이드레이션 뒤에 알므로 그때 target을 뗀다.
 * 녹음 상태는 최상위 Provider에 있어 앱 안 이동에도 이어진다.
 */
export function SitePageLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "target" | "rel"> & { href: string }) {
  const inApp = useDesktopApp() === true;
  return (
    <Link
      href={href}
      {...(inApp ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      {...props}
    />
  );
}
