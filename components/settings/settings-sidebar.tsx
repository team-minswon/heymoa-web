"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Building2,
  FolderKanban,
  Plug,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * 설정은 워크스페이스 사이드바를 **같은 자리에서 교체한다**. 라우트는 바뀌지만 콘텐츠 팬은
 * 그대로라 「다른 곳으로 갔다」가 아니라 「같은 자리에서 모드가 바뀌었다」로 읽힌다.
 *
 * 계정·알림은 유저 스코프인데 라우트는 워크스페이스 안이다. 밖으로 빼면 같은 설정 셸을
 * 두 벌 유지해야 하고, 워크스페이스 layout 이 언마운트돼 녹음 같은 상시 표면이 끊긴다.
 */
const GROUPS = [
  {
    label: "워크스페이스",
    items: [
      { slug: "general", label: "일반", Icon: Building2 },
      { slug: "members", label: "멤버", Icon: UsersRound },
      { slug: "projects", label: "프로젝트", Icon: FolderKanban },
      { slug: "integrations", label: "연동", Icon: Plug },
    ],
  },
  {
    label: "계정",
    items: [
      { slug: "account", label: "내 계정", Icon: UserRound },
      { slug: "notifications", label: "알림", Icon: Bell },
    ],
  },
] as const;

export function SettingsSidebar({
  workspaceId,
  workspaceName,
  section,
}: {
  workspaceId: string;
  workspaceName?: string;
  section: string;
}) {
  const router = useRouter();

  return (
    <Sidebar collapsible="none" className="border-r">
      <SidebarHeader className="p-0">
        <button
          onClick={() => router.push(`/w/${workspaceId}`)}
          className="flex h-[60px] w-full items-center gap-2.5 border-b border-[var(--el-hairline)] px-3.5 text-left"
        >
          <span className="flex size-8 items-center justify-center rounded-control border border-[var(--control-border)]">
            <ArrowLeft className="size-4 text-[var(--el-muted)]" />
          </span>
          <span className="text-[13px] font-semibold">워크스페이스로</span>
        </button>
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-3">
        <nav aria-label="설정">
          {GROUPS.map((group) => (
            <SidebarGroup key={group.label} className="py-0.5">
              <SidebarGroupLabel className="h-7 px-3 text-[11px] font-bold text-[var(--el-muted)]">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map(({ slug, label, Icon }) => (
                    <SidebarMenuItem key={slug}>
                      <SidebarMenuButton
                        isActive={section === slug}
                        onClick={() =>
                          router.push(`/w/${workspaceId}/settings/${slug}`)
                        }
                        className="h-8 gap-2.5 rounded-control px-2.5 text-[13px] font-medium"
                      >
                        <Icon className="size-4 text-[var(--el-muted)]" />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter className="border-t border-[var(--el-hairline)] p-0">
        <div className="flex h-[60px] items-center gap-2.5 px-3.5">
          <span className="flex size-7 items-center justify-center rounded-control bg-secondary text-[11px] font-semibold text-[var(--el-body)]">
            {(workspaceName ?? "W").slice(0, 1)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">
              {workspaceName ?? "워크스페이스"}
            </span>
            <span className="block text-[11px] text-[var(--el-muted)]">
              설정 중
            </span>
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
