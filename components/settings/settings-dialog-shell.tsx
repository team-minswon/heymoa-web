"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, Folder, Plug, Settings, User, Users, X } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useWorkspaceShell } from "@/components/workspace/workspace-app-shell";
import { cn } from "@/lib/utils";

/**
 * 설정은 **앱 위에 뜬다** — 워크스페이스를 떠나지 않는다(design.pen `LS24B`).
 * 라우트(`/w/{wid}/settings/*`)는 그대로 둔다: 연동은 OAuth 로 브라우저가 밖에 나갔다
 * 오는데, 라우트가 없으면 돌아올 자리가 없다. 딥링크·새로고침·뒤로가기도 라우트가 지킨다.
 *
 * 기하는 전부 design.pen 실측이다 — 1040×576 · 나비 232 · 스크림 25% · blur 없음.
 */
const GROUPS = [
  {
    label: "워크스페이스",
    items: [
      { slug: "general", label: "일반", Icon: Settings },
      { slug: "members", label: "멤버", Icon: Users },
      { slug: "projects", label: "프로젝트", Icon: Folder },
      { slug: "integrations", label: "연동", Icon: Plug },
    ],
  },
  {
    label: "계정",
    items: [
      { slug: "account", label: "내 계정", Icon: User },
      { slug: "notifications", label: "알림", Icon: Bell },
    ],
  },
] as const;

const TITLE: Record<string, string> = {
  general: "일반",
  members: "멤버",
  projects: "프로젝트",
  integrations: "연동",
  account: "내 계정",
  notifications: "알림",
};

export function SettingsDialogShell({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // 셸이 이미 워크스페이스를 한 번 읽었다 — 여기서 또 구독하면 같은 질의가 두 벌이 된다.
  const workspaceName = useWorkspaceShell().workspace?.name;
  const section = pathname.match(/\/settings\/([^/?]+)/)?.[1] ?? "general";
  // 닫으면 워크스페이스로 돌아간다. `back()` 은 설정을 딥링크로 연 경우 앱 밖으로 나간다.
  const close = () => router.push(`/w/${workspaceId}/meetings`);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[#0c0a09]/25 supports-backdrop-filter:backdrop-blur-none"
        aria-label="설정"
        // primitive 의 `sm:max-w-sm`·`zoom-in-95`·`shadow-e3` 은 변종이거나 커스텀 토큰이라
        // tailwind-merge 가 못 지운다 — 같은 변종으로 덮고, 그림자만 `!` 로 이긴다.
        // 설정은 확대 진입을 하지 않는다: 앱 위에 그대로 얹히는 판이다(design.pen `LS24B`).
        className="flex h-[576px] max-h-[calc(100svh-2rem)] w-[1040px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-card p-0 text-[var(--el-ink)] shadow-[0_24px_64px_-12px_#0c0a0938,0_2px_6px_0_#0c0a0914]! ring-0 data-closed:zoom-out-100 data-open:zoom-in-100 sm:max-w-[calc(100%-2rem)]"
      >
        <nav
          aria-label="설정 구역"
          className="flex h-full w-[232px] shrink-0 flex-col border-r border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] pt-4 pr-3 pb-3 pl-3"
        >
          <DialogTitle className="flex h-10 items-center px-3 font-serif text-[19px] font-light text-[var(--el-ink)]">
            설정
          </DialogTitle>
          <div aria-hidden className="h-2.5 shrink-0" />

          {GROUPS.map((group, index) => (
            <div key={group.label} className="flex w-full flex-col gap-px">
              {index > 0 ? <div aria-hidden className="h-3.5 shrink-0" /> : null}
              <div className="flex h-[26px] items-center px-3">
                <span className="text-[10px] font-bold tracking-[0.9px] text-[var(--el-muted)]">
                  {group.label}
                </span>
              </div>
              {group.items.map(({ slug, label, Icon }) => {
                const active = section === slug;
                return (
                  <div key={slug} className="flex h-[34px] w-full items-center">
                    <span
                      aria-hidden
                      className={cn(
                        "h-[18px] w-[2px] shrink-0 rounded-full",
                        active ? "bg-[var(--el-ink)]" : "bg-transparent"
                      )}
                    />
                    <button
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() =>
                        router.push(`/w/${workspaceId}/settings/${slug}`)
                      }
                      className={cn(
                        "flex h-[34px] min-w-0 flex-1 items-center gap-2 rounded-control px-2.5 text-left transition-colors",
                        active
                          ? "border border-[var(--el-hairline)] bg-card"
                          : "hover:bg-card/60"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active
                            ? "text-[var(--el-ink)]"
                            : "text-[var(--el-muted)]"
                        )}
                      />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[13px]",
                          active
                            ? "font-semibold text-[var(--el-ink)]"
                            : "text-[var(--el-body)]"
                        )}
                      >
                        {label}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}

          <div className="flex-1" />
          {/* 계정 절과 워크스페이스 절이 한 나비에 섞여 있다 — 지금 무엇을 고치고 있는지
              바닥이 말한다. */}
          <div className="flex h-[52px] shrink-0 items-center gap-2.5 rounded-control border-t border-[var(--el-hairline)] px-2.5">
            <span className="flex size-7 items-center justify-center rounded-control bg-[var(--el-surface-strong)] text-[11px] font-semibold text-[var(--el-body)]">
              {(workspaceName ?? "W").trim().slice(0, 1)}
            </span>
            <span className="flex min-w-0 flex-col gap-px">
              <span className="truncate text-[13px] text-[var(--el-ink)]">
                {workspaceName ?? "워크스페이스"}
              </span>
              <span className="text-[11px] text-[var(--el-muted)]">
                설정 중
              </span>
            </span>
          </div>
        </nav>

        <div className="flex h-full min-w-0 flex-1 flex-col bg-card">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--el-hairline)] pr-5 pl-7">
            <h2 className="text-[15px] font-semibold text-[var(--el-ink)]">
              {TITLE[section] ?? "설정"}
            </h2>
            <button
              type="button"
              aria-label="설정 닫기"
              onClick={close}
              className="flex size-[30px] items-center justify-center rounded-control text-[var(--el-muted)] hover:bg-[var(--el-surface-strong)]"
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex w-full flex-col px-7 pt-[22px] pb-7">
              {children}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
