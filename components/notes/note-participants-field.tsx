"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  NoteParticipantAvatars,
  type Participant,
} from "@/components/notes/note-participants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getGetNoteQueryKey,
  getGetNotesQueryKey,
  useReplaceNoteParticipants,
} from "@/lib/api/generated/notes/notes";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * 참여자를 워크스페이스 멤버 드롭다운에서 체크박스로 고른다.
 *
 * **닫힐 때 한 번만 저장한다.** 체크마다 보내면 빠르게 여러 번 누른 사용자가 요청을 줄줄이
 * 만들고, 응답이 보낸 순서대로 돌아온다는 보장도 없다. 서버가 전체 교체라 마지막 상태
 * 한 번이면 충분하다.
 */
export function NoteParticipantsField({
  noteId,
  projectId,
  workspaceId,
  participants,
}: {
  noteId: string;
  projectId: string;
  workspaceId: string;
  participants: Participant[];
}) {
  const queryClient = useQueryClient();
  const membersResponse = useGetWorkspaceMembers(workspaceId);
  // 실패 토스트는 전역(`MutationCache.onError`)이 서버 문구 그대로 띄운다. 여기서 또 띄우면
  // 두 개가 겹친다 — opt-out은 화면이 인라인으로 그리거나 코드별 문구가 갈릴 때만 쓴다.
  const replaceParticipants = useReplaceNoteParticipants();

  const saved = participants.map((participant) => participant.userId);
  /**
   * 사용자가 **실제로 체크를 건드렸을 때만** 채워지는 임시 선택. 열 때 미리 채우지 않는다 —
   * 열어만 두고 닫는 동안 폴링이 다른 사람의 변경을 가져오면, 아무것도 안 건드린 사용자가
   * 열던 시점의 낡은 목록으로 그 변경을 되돌리게 된다. null이면 보낼 것이 없다는 뜻이다.
   */
  const [draft, setDraft] = useState<string[] | null>(null);
  const selected = draft ?? saved;

  const membersData = membersResponse.data;
  const members =
    membersData?.status === 200 && membersData.data.success
      ? membersData.data.data.members
      : [];
  // 로딩과 실패를 뭉치면 메뉴를 연 직후 "불러오지 못했습니다"가 먼저 뜬다.
  const membersPending = membersResponse.isPending;

  async function save(next: string[]) {
    if (sameSet(next, saved)) return;
    // `apiFetch`는 비-2xx 봉투를 그대로 throw한다(`parseResponse`). 실패는 전역 토스트가
    // 서버 문구로 알리므로 여기서는 갱신만 건너뛴다.
    try {
      await replaceParticipants.mutateAsync({
        noteId,
        data: { userIds: next },
      });
    } catch {
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) }),
      queryClient.invalidateQueries({
        queryKey: getGetNotesQueryKey(projectId),
      }),
    ]);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {participants.length > 0 ? (
        <NoteParticipantAvatars
          participants={participants}
          max={5}
          size="default"
        />
      ) : (
        <span className="text-sm text-[var(--el-muted)]">
          아직 참여자가 없습니다.
        </span>
      )}

      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            // 종료된 노트는 폴링이 멈춰 있어 다른 사람이 바꾼 참여자가 안 들어온다.
            // 고르기 직전에 한 번 당겨 체크 상태를 최신으로 맞춘다.
            void queryClient.invalidateQueries({
              queryKey: getGetNoteQueryKey(noteId),
            });
            return;
          }
          const next = draft;
          setDraft(null);
          if (next) void save(next);
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              loading={replaceParticipants.isPending}
            >
              <UserPlus /> 참여자 선택
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            {/* Base UI의 그룹 라벨은 Menu.Group 안에서만 쓸 수 있다. */}
            <DropdownMenuLabel>워크스페이스 멤버</DropdownMenuLabel>
            {membersPending ? (
              <p className="px-1.5 py-2 text-sm text-muted-foreground">
                멤버를 불러오는 중입니다.
              </p>
            ) : members.length === 0 ? (
              // 조회 훅이 메뉴 밖에 마운트되어 있어 닫았다 열어도 다시 안 부른다.
              <div className="space-y-2 px-1.5 py-2">
                <p className="text-sm text-muted-foreground">
                  멤버를 불러오지 못했습니다.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void membersResponse.refetch()}
                >
                  다시 시도
                </Button>
              </div>
            ) : (
              members.map((member) => (
                <DropdownMenuCheckboxItem
                  key={member.userId}
                  checked={selected.includes(member.userId)}
                  // 고르는 동안 메뉴가 닫히면 나머지를 다시 열어 골라야 한다.
                  closeOnClick={false}
                  onCheckedChange={(checked) =>
                    setDraft((current) => {
                      const base = current ?? saved;
                      return checked
                        ? [...base, member.userId]
                        : base.filter((userId) => userId !== member.userId);
                    })
                  }
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{member.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
