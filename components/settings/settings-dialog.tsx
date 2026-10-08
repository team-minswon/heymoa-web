"use client";

import { useCallback, useState } from "react";
import { Bot, Building2, Plug, UserRound, UsersRound } from "lucide-react";
import {
  AccountSettingsForm,
  AccountSettingsFormSkeleton,
} from "@/components/settings/account-settings-form";
import { AgentConnectionsSettings } from "@/components/settings/agent-connections-settings";
import { MembersSettings } from "@/components/settings/members-settings";
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

export type SettingsSection =
  | "account"
  | "workspace"
  | "members"
  | "integrations"
  | "workspaceAgents"
  | "agents";

/**
 * 워크스페이스에 영향을 주는 설정과 내 계정 설정을 갈라 둔다. 프레임 `WKSCp`의 두 그룹이고,
 * 계약에 없는 항목(알림 설정 등)은 만들지 않는다 — 있는 것을 나누는 데서 멈춘다.
 *
 * 외부 에이전트 연결(APP-804)은 **계정** 쪽이다. 위임은 팀원 본인이 만들고 본인만 보며,
 * 워크스페이스 설정을 바꾸지 않는다(제품 정의 「표면과 위임」). 팀이 그 연결을 받을지와 열린 연결을
 * 끊는 관리(APP-941)는 **워크스페이스** 쪽 같은 이름의 항목이다. 「연동」은 HeyMoa 가 나가는 연결이라
 * 들어오는 연결과 섞지 않는다.
 */
const SETTINGS_GROUPS: {
  label: string;
  items: {
    key: SettingsSection;
    label: string;
    Icon: typeof Building2;
  }[];
}[] = [
  {
    label: "워크스페이스",
    items: [
      { key: "workspace", label: "일반", Icon: Building2 },
      { key: "members", label: "멤버", Icon: UsersRound },
      { key: "integrations", label: "연동", Icon: Plug },
      { key: "workspaceAgents", label: "외부 에이전트", Icon: Bot },
    ],
  },
  {
    label: "계정",
    items: [
      { key: "account", label: "내 계정", Icon: UserRound },
      { key: "agents", label: "외부 에이전트", Icon: Bot },
    ],
  },
];

function SettingsSections({
  initialSection,
  workspaceId,
  locked,
  onLockChange,
}: {
  initialSection: SettingsSection;
  workspaceId: string;
  /** 섹션이 되돌릴 수 없는 일을 하는 중이다 — 다른 섹션으로 못 옮긴다. */
  locked: boolean;
  onLockChange: (locked: boolean) => void;
}) {
  const [section, setSection] = useState(initialSection);
  return (
    <div className="grid h-full min-h-0 bg-[var(--el-canvas-soft)] md:grid-cols-[220px_1fr]">
      <nav
        aria-label="설정"
        className="border-b border-[var(--el-hairline)] bg-[var(--el-canvas)] p-4 md:border-r md:border-b-0 md:p-6"
      >
        {/* 제품 면에 대문자 키커를 두지 않는다 — 세리프 제목만 남긴다. (FORM SPEC) */}
        <p className="mb-7 font-serif text-3xl font-light tracking-[-0.03em]">
          설정
        </p>
        {/* 워크스페이스 것과 내 계정 것이 섞여 있으면 무엇이 팀에 영향을 주는지 안 읽힌다. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-1">
          {SETTINGS_GROUPS.map((group) => (
            // 라벨이 `일반`처럼 짧아 그룹 밖에서는 무엇의 일반인지 모른다 — 보조기술이
            // "워크스페이스 그룹, 일반"으로 읽도록 그룹에 이름을 준다.
            <div
              key={group.label}
              role="group"
              aria-label={group.label}
              className="grid gap-1"
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
                  variant={section === key ? "secondary" : "ghost"}
                  disabled={locked && section !== key}
                  onClick={() => setSection(key)}
                  className="h-10 justify-start gap-2.5 rounded-block px-3"
                >
                  <Icon />
                  {label}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </nav>
      <div className="min-h-0 overflow-y-auto bg-white/60 p-6 pt-14 sm:p-10 md:p-14">
        {section === "account" ? (
          <DataBoundary
            fallback={<AccountSettingsFormSkeleton />}
            errorLabel="계정 정보를 불러오지 못했습니다"
            resetKeys={["account"]}
          >
            <AccountSettingsForm />
          </DataBoundary>
        ) : section === "members" ? (
          <MembersSettings workspaceId={workspaceId} />
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
  initialSection = "account",
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SettingsSection;
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
          key={`${initialSection}-${open}`}
          initialSection={initialSection}
          workspaceId={workspaceId}
          locked={locked}
          onLockChange={setLocked}
        />
      </DialogContent>
    </Dialog>
  );
}
