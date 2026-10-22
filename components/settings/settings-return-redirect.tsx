"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { WorkspaceRouteSkeleton } from "@/components/workspace/workspace-route-skeleton";
import { getWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { pickWorkspaceId } from "@/lib/workspaces/last-workspace";
import {
  SETTINGS_PARAM,
  type SettingsSection,
} from "@/lib/workspace/settings-url";

/**
 * OAuth 연동 승인 후 서버가 돌려보내는 `/settings/integrations?provider=&status=`를 받는다.
 * 설정은 모달이라 전용 라우트가 없으므로, 마지막으로 연 워크스페이스로 리다이렉트하며 쿼리를 그대로
 * 넘긴다 — 그러면 workspace-app-shell이 provider·status를 읽어 연동 모달을 열고 결과 토스트를
 * 띄운다(APP-194). 주소에 workspaceId가 없어서 고르는 것이지, 연동 자체는 서버가 올바른
 * 워크스페이스에 저장한다(모달은 표시용).
 *
 * `section` 을 주면 그 설정 탭을 연다 — 메일 푸터의 「알림 설정」(`/settings/notifications`, APP-1341)이 쓴다.
 * 알림 설정은 사용자 단위라 어느 워크스페이스에서 열어도 같다.
 */
export function SettingsReturnRedirect({
  section,
  extra,
}: {
  section?: SettingsSection;
  /** 더 붙일 쿼리 — 문의 답변 메일의 `/inquiries/{id}` 가 `inquiry` 를 넘긴다(APP-1399) */
  extra?: Record<string, string>;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams(searchParams.toString());
    if (section) params.set(SETTINGS_PARAM, section);
    for (const [key, value] of Object.entries(extra ?? {}))
      params.set(key, value);
    const query = params.toString();
    const suffix = query ? `?${query}` : "";

    void (async () => {
      try {
        const response = await getWorkspaces();
        if (ignore) return;
        const items =
          response.status === 200 && response.data.success
            ? (response.data.data.workspaces ?? [])
            : [];
        const selected = pickWorkspaceId(items);
        router.replace(selected ? `/w/${selected}${suffix}` : "/");
      } catch {
        if (!ignore) router.replace("/");
      }
    })();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `extra` 는 렌더마다 새 객체다. 값은 주소가 정해 바뀌지 않는다
  }, [router, searchParams, section]);

  return <WorkspaceRouteSkeleton />;
}
