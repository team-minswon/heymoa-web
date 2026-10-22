"use client";

import { track } from "@/lib/analytics/track";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { SettingsSection } from "@/lib/workspace/settings-url";
import {
  BellRing,
  BookA,
  Bot,
  Plug,
  Settings,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import {
  AccountSettingsForm,
  AccountSettingsFormSkeleton,
} from "@/components/settings/account-settings-form";
import { AgentConnectionsSettings } from "@/components/settings/agent-connections-settings";
import { GuestsSettings } from "@/components/settings/guests-settings";
import { MembersSettings } from "@/components/settings/members-settings";
import {
  NotificationSettings,
  NotificationSettingsSkeleton,
} from "@/components/settings/notification-settings";
import { WorkspaceTermsSettings } from "@/components/terms/workspace-terms-settings";
import { WorkspaceAgentAccessSettings } from "@/components/settings/workspace-agent-access-settings";
import { WorkspaceIntegrationsSettings } from "@/components/settings/workspace-integrations-settings";
import {
  WorkspaceSettingsForm,
  WorkspaceSettingsFormSkeleton,
} from "@/components/settings/workspace-settings-form";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type { SettingsSection };

/**
 * 워크스페이스에 영향을 주는 설정과 내 계정 설정을 갈라 둔다. 프레임 `WKSCp`의 두 그룹이고,
 * 계약에 있는 것만 둔다. 알림(PRO-67 I10)은 사용자 단위라 계정 쪽이고 모든 워크스페이스에 같이 적용된다.
 * 아이콘은 `BellRing` — 사이드바 「알림」(`Bell`)은 목록을 여는 다른 목적지다.
 *
 * 외부 에이전트 연결(APP-804)은 **계정** 쪽이다. 위임은 팀원 본인이 만들고 본인만 보며,
 * 워크스페이스 설정을 바꾸지 않는다(제품 정의 「표면과 위임」). 팀이 그 연결을 받을지와 열린 연결을
 * 끊는 관리(APP-941)는 **워크스페이스** 쪽 「MCP 연결」이다. 두 항목은 같은 말에 누구 것인지를 붙여 가른다
 * (Notion 「연결 / 내 연결」 식) — 둘 다 「외부 에이전트」였을 때는 메뉴만 보고 어느 쪽인지 갈리지 않았다.
 * 아이콘도 가른다(APP-1325): 내 연결은 `Bot`, 팀이 받을지 정하는 쪽은 `ShieldCheck`. 같은 목적지는
 * 사이드바 메뉴와 같은 아이콘이다 — 「워크스페이스 설정」이 여는 「일반」은 `Settings`, 「내 계정 설정」이 여는
 * 「내 계정」은 `UserRound`.
 * 그 말을 「MCP」로 한 것은 사용자가 연결하며 상대편에서 보는 말(claude.ai 커넥터의 원격 MCP 서버 URL,
 * ChatGPT 개발자 모드, `mcp add`)과 맞추려는 것이다. 뜻은 각 화면의 설명 문장이 쉬운 말로 푼다.
 * 「연동」은 HeyMoa 가 나가는 연결이라 들어오는 연결과 섞지 않는다.
 */
const SETTINGS_GROUPS: {
  label: string;
  items: {
    key: SettingsSection;
    label: string;
    Icon: typeof Settings;
  }[];
}[] = [
  {
    label: "워크스페이스",
    items: [
      { key: "workspace", label: "일반", Icon: Settings },
      { key: "members", label: "멤버", Icon: UsersRound },
      { key: "guests", label: "임시 참여자", Icon: UserRoundPlus },
      { key: "terms", label: "용어 사전", Icon: BookA },
      { key: "integrations", label: "연동", Icon: Plug },
      { key: "workspaceAgents", label: "MCP 연결", Icon: ShieldCheck },
    ],
  },
  {
    label: "계정",
    items: [
      { key: "account", label: "내 계정", Icon: UserRound },
      { key: "notifications", label: "알림", Icon: BellRing },
      { key: "agents", label: "내 MCP 연결", Icon: Bot },
    ],
  },
];

function SettingsSections({
  section,
  onSectionChange,
  workspaceId,
  locked,
  onLockChange,
}: {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  workspaceId: string;
  /** 섹션이 되돌릴 수 없는 일을 하는 중이다 — 다른 섹션으로 못 옮긴다. */
  locked: boolean;
  onLockChange: (locked: boolean) => void;
}) {
  return (
    <div className="grid h-full min-h-0 bg-[var(--el-canvas-soft)] md:grid-cols-[220px_1fr]">
      <nav
        aria-label="설정"
        className="border-b border-[var(--el-hairline)] bg-[var(--el-canvas)] p-4 md:border-r md:border-b-0 md:p-6"
      >
        {/* 제품 면에 대문자 키커를 두지 않는다 — 세리프 제목만 남긴다. (FORM SPEC) */}
        <p className="mb-7 text-3xl font-light tracking-[-0.03em]">설정</p>
        {/* 워크스페이스 것과 내 계정 것이 섞여 있으면 무엇이 팀에 영향을 주는지 안 읽힌다. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-1">
          {SETTINGS_GROUPS.map((group) => (
            // 라벨이 `일반`처럼 짧아 그룹 밖에서는 무엇의 일반인지 모른다 — 보조기술이
            // "워크스페이스 그룹, 일반"으로 읽도록 그룹에 이름을 준다.
            <div
              key={group.label}
              role="group"
              aria-label={group.label}
              className="grid content-start gap-1"
            >
              <p
                aria-hidden
                className="px-3 pb-1 text-xs text-[var(--el-muted)]"
              >
                {group.label}
              </p>
              {group.items.map(({ key, label, Icon }) => (
                <Button
                  key={key}
                  type="button"
                  variant="ghost"
                  disabled={locked && section !== key}
                  onClick={() => {
                    if (section === key) return;
                    track("settings_tab_opened", {
                      workspace_id: workspaceId,
                      section: key,
                      from: "settings",
                    });
                    onSectionChange(key);
                  }}
                  aria-current={section === key ? "page" : undefined}
                  // 회색 바탕이라 선택(hairline)과 호버(surface-strong)를 한 단계씩 벌린다. 같은 색의 농도만 바꾸면
                  // (APP-1195) 바탕과 4단계 차이라 눈으로 갈리지 않았다(APP-1205).
                  className={cn(
                    "h-10 justify-start gap-2.5 rounded-block px-3",
                    section === key
                      ? "bg-[var(--el-hairline)] font-medium hover:bg-[var(--el-hairline)]"
                      : "hover:bg-[var(--el-surface-strong)]"
                  )}
                >
                  <Icon className="size-4 text-[var(--el-muted)]" aria-hidden />
                  {label}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </nav>
      <div
        data-testid="settings-panel"
        className="min-h-0 overflow-y-auto bg-white/60 p-6 pt-14 sm:p-10 md:p-14"
      >
        {section === "account" ? (
          <DataBoundary
            fallback={<AccountSettingsFormSkeleton />}
            errorLabel="계정 정보를 불러오지 못했습니다"
            resetKeys={["account"]}
          >
            <AccountSettingsForm />
          </DataBoundary>
        ) : section === "notifications" ? (
          <DataBoundary
            fallback={<NotificationSettingsSkeleton />}
            errorLabel="알림 설정을 불러오지 못했습니다"
            resetKeys={["notifications"]}
          >
            <NotificationSettings workspaceId={workspaceId} />
          </DataBoundary>
        ) : section === "members" ? (
          <MembersSettings workspaceId={workspaceId} />
        ) : section === "guests" ? (
          <GuestsSettings workspaceId={workspaceId} />
        ) : section === "terms" ? (
          <WorkspaceTermsSettings workspaceId={workspaceId} />
        ) : section === "integrations" ? (
          <WorkspaceIntegrationsSettings workspaceId={workspaceId} />
        ) : section === "workspaceAgents" ? (
          <WorkspaceAgentAccessSettings workspaceId={workspaceId} />
        ) : section === "agents" ? (
          <AgentConnectionsSettings
            workspaceId={workspaceId}
            onBusyChange={onLockChange}
          />
        ) : (
          <DataBoundary
            fallback={<WorkspaceSettingsFormSkeleton />}
            errorLabel="워크스페이스 정보를 불러오지 못했습니다"
            resetKeys={["workspace"]}
          >
            <WorkspaceSettingsForm workspaceId={workspaceId} />
          </DataBoundary>
        )}
      </div>
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  section,
  onSectionChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 열린 탭. 주소(`?settings=`)가 단일 출처라 셸이 들고 있다. */
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  workspaceId: string;
}) {
  // **응답을 받아야 끝나는 일이 도는 동안은 닫지 않는다.** 외부 에이전트 토큰은 만든 응답에서만
  // 한 번 나오므로, 그 사이 창이 닫히면 발급된 토큰을 아무도 못 본다. 닫기(X·Esc·바깥 클릭)는
  // 전부 여기로 오고, 섹션 이동은 nav 가 같은 값으로 막는다.
  const [locked, setLocked] = useState(false);
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && locked) return;
      onOpenChange(next);
    },
    [locked, onOpenChange]
  );
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* 오버레이는 e3 2연타 + panel 16이다. rounded-[28px]는 스케일 밖 값이라 폐기했다. (ELEVATION SPEC) */}
      <DialogContent className="h-dvh max-h-none w-screen max-w-none gap-0 overflow-hidden rounded-none border border-black/5 bg-[var(--el-canvas)] p-0 shadow-e3 sm:h-[min(780px,calc(100dvh-3rem))] sm:max-w-5xl sm:rounded-panel">
        <DialogTitle className="sr-only">설정</DialogTitle>
        <DialogDescription className="sr-only">
          계정과 워크스페이스 설정을 관리합니다.
        </DialogDescription>
        <SettingsSections
          section={section}
          onSectionChange={onSectionChange}
          workspaceId={workspaceId}
          locked={locked}
          onLockChange={setLocked}
        />
      </DialogContent>
    </Dialog>
  );
}
