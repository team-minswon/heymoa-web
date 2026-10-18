"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { WorkspaceGuestsSettings } from "@/components/settings/workspace-guests-settings";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";

/**
 * 설정의 임시 참여자 탭. 멤버 탭 아래에 붙어 있던 것을 따로 뗐다 — 멤버 목록과 같은 화면에 있으면 역할 변경·내보내기가
 * 임시 참여자에게도 있는 것처럼 읽히고, 참여자 추가 팝업의 「임시 참여자 관리」가 어디로 가는지도 흐려졌다.
 *
 * **목록은 전원이 보고 관리(연동·삭제)만 ADMIN이다.** 역할은 멤버 목록의 내 userId로 가른다(멤버 설정과 같은 규칙).
 */
export function GuestsSettings({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const membersQuery = useGetWorkspaceMembers(workspaceId);
  const response = membersQuery.data;
  const members =
    response !== undefined && response.status === 200 && response.data.success
      ? (response.data.data?.members ?? [])
      : [];
  const myRole = members.find((member) => member.userId === user?.userId)?.role;
  const canManage = myRole === "ADMIN" && !membersQuery.isError;

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <header className="mb-8">
        <h2 className="text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
          임시 참여자
        </h2>
        <p className="mt-2 text-sm text-[var(--el-muted)]">
          계정 없이 회의에 참여한 사람입니다. 나중에 계정이 생기면 이어 붙일 수
          있습니다.
        </p>
      </header>
      <WorkspaceGuestsSettings
        workspaceId={workspaceId}
        canManage={canManage}
        standalone
      />
    </div>
  );
}
