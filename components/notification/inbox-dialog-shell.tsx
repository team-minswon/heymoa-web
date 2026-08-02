"use client";

import { useRouter } from "next/navigation";

import { Dialog, DialogContent } from "@/components/ui/dialog";

/**
 * 받은 알림도 설정과 같이 **앱 위에 뜬다**(design.pen `IBjny`). 설정만 다이얼로그이고
 * 알림은 전면 페이지면, 사이드바에 나란히 있는 두 항목이 서로 다르게 움직인다.
 *
 * 라우트(`/w/{wid}/inbox`)는 그대로다 — 딥링크·새로고침·뒤로가기가 라우트의 몫이다.
 * 기하는 design.pen 실측: 720×576 · 스크림 25% · blur 없음.
 */
export function InboxDialogShell({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const close = () => router.push(`/w/${workspaceId}/meetings`);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[#0c0a09]/25 supports-backdrop-filter:backdrop-blur-none"
        aria-label="받은 알림"
        // primitive 의 `sm:max-w-sm`·`zoom-in-95`·`shadow-e3` 은 변종이거나 커스텀 토큰이라
        // tailwind-merge 가 못 지운다 — 같은 변종으로 덮고, 그림자만 `!` 로 이긴다.
        className="flex h-[576px] max-h-[calc(100svh-2rem)] w-[720px] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-card p-0 text-[var(--el-ink)] shadow-[0_24px_64px_-12px_#0c0a0938,0_2px_6px_0_#0c0a0914]! ring-0 data-closed:zoom-out-100 data-open:zoom-in-100 sm:max-w-[calc(100%-2rem)]"
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
