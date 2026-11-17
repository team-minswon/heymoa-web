"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { desktopBridge } from "@/lib/desktop/bridge";
import { useAuth } from "@/components/auth/auth-provider";
import { useGetWorkspaces } from "@/lib/api/generated/workspaces/workspaces";
import { pickWorkspaceId } from "@/lib/workspaces/last-workspace";

export function DesktopLaunchRedirect() {
  const router = useRouter();
  const { status } = useAuth();
  const bridge = desktopBridge();
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
