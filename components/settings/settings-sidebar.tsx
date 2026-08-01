"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Folder,
  Plug,
  Settings,
  User,
  Users,
} from "lucide-react";

import { NavRow } from "@/components/workspace/nav-row";

/**
 * 설정은 워크스페이스 사이드바를 **같은 232 슬롯에서 교체한다**. 라우트는 바뀌지만 패널은
 * 그대로라 「다른 곳으로 갔다」가 아니라 「같은 자리에서 모드가 바뀌었다」로 읽힌다.
 *
 * 계정·알림은 유저 스코프인데 라우트는 워크스페이스 안이다. 밖으로 빼면 같은 설정 셸을
 * 두 벌 유지해야 하고, 워크스페이스 layout 이 언마운트돼 녹음 같은 상시 표면이 끊긴다.
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
    <div className="flex h-full flex-col py-2.5">
      <button
        type="button"
        onClick={() => router.push(`/w/${workspaceId}/meetings`)}
        className="flex h-[60px] w-full shrink-0 items-center gap-2.5 border-b border-[var(--el-hairline)] px-3.5 text-left"
      >
        <span className="flex size-8 items-center justify-center rounded-control border border-[var(--control-border)]">
          <ArrowLeft className="size-4 text-[var(--el-muted)]" />
        </span>
        <span className="text-[13px] font-semibold text-[var(--el-ink)]">
          워크스페이스로
        </span>
      </button>

      <nav aria-label="설정" className="min-h-0 flex-1 overflow-y-auto pt-3">
        {GROUPS.map((group, index) => (
          <div
            key={group.label}
            className={index === 0 ? "px-2.5" : "px-2.5 pt-4"}
          >
            <div className="flex h-7 items-center px-3">
              <span className="text-[11px] font-bold text-[var(--el-muted)]">
                {group.label}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ slug, label, Icon }) => (
                <NavRow
                  key={slug}
                  icon={Icon}
                  label={label}
                  active={section === slug}
                  onClick={() =>
                    router.push(`/w/${workspaceId}/settings/${slug}`)
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex h-[60px] shrink-0 items-center gap-2.5 border-t border-[var(--el-hairline)] px-3.5">
        <span className="flex size-7 items-center justify-center rounded-control bg-[var(--el-surface-strong)] text-[11px] font-semibold text-[var(--el-body)]">
          {(workspaceName ?? "W").trim().slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-[var(--el-ink)]">
            {workspaceName ?? "워크스페이스"}
          </span>
          <span className="block text-[11px] text-[var(--el-muted)]">
            설정 중
          </span>
        </span>
      </div>
    </div>
  );
}
