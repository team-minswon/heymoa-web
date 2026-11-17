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

export function SettingsReturnRedirect({
  section,
  extra,
}: {
  section?: SettingsSection;
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
