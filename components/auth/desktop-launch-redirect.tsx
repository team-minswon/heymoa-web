"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DesktopBridge } from "@heymoa/desktop-contracts";
import { useAuth } from "@/components/auth/auth-provider";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { pickWorkspaceId } from "@/lib/workspaces/last-workspace";

/** 설치 앱의 시작 주소는 랜딩이므로, 소속을 새로 확인한 뒤 제품으로 진입한다. */
export function DesktopLaunchRedirect() {
  const router = useRouter();
  const { status } = useAuth();
  const bridge =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as { heymoaDesktop?: DesktopBridge }).heymoaDesktop;
  const desktop = typeof bridge?.getCapabilities === "function";
  const query = useGetWorkspaces({
    query: {
      enabled: desktop && status === "authenticated",
      staleTime: 0,
      refetchOnMount: "always",
    },
  });

  useEffect(() => {
    if (!desktop) return;
    const envelope = query.data?.status === 200 ? query.data.data : undefined;
    const ready =
      status === "authenticated" &&
      query.isSuccess &&
      !query.isFetching &&
      !query.isError &&
      envelope?.success;
    const workspaceId = ready
      ? pickWorkspaceId(envelope.data.workspaces ?? [])
      : undefined;
    if (workspaceId) {
      router.replace(`/w/${encodeURIComponent(workspaceId)}`);
      return;
    }
    const listStatus =
      status === "anonymous" || ready
        ? "no-workspace"
        : status === "checking" || query.isFetching || query.isPending
          ? "loading"
          : "failed";
    void bridge
      ?.reportMeetingList?.({
        workspaceId: null,
        status: listStatus,
        meetings: [],
      })
      .catch(() => {});
  }, [
    bridge,
    desktop,
    status,
    query.data,
    query.isSuccess,
    query.isFetching,
    query.isError,
    query.isPending,
    router,
  ]);
  return null;
}
