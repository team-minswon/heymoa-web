"use client";

import { useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  NoteParticipantAvatars,
  ParticipantAvatar,
  type Participant,
} from "@/components/notes/note-participants";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  getGetNoteQueryKey,
  getGetNotesQueryKey,
  useReplaceNoteParticipants,
} from "@/lib/api/generated/notes/notes";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";

type Member = {
  userId: string;
  name: string;
  email: string;
  image?: string | null;
};

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * 참여자를 워크스페이스 멤버 combobox에서 고른다. 멤버가 늘면 체크박스 목록은 눈으로 훑어야
 * 하지만 검색은 이름·이메일 한 조각으로 바로 좁힌다. 목록 높이는 `ComboboxList`가 남은 화면에
 * 맞춰 잘라 스크롤하므로 멤버 수와 무관하다.
 *
 * **닫힐 때 한 번만 저장한다.** 고를 때마다 보내면 요청이 줄줄이 나가고 응답이 보낸 순서대로
 * 돌아온다는 보장도 없다. 서버가 전체 교체라 마지막 상태 한 번이면 충분하다.
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
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const membersResponse = useGetWorkspaceMembers(workspaceId);
  // 실패 토스트는 전역(`MutationCache.onError`)이 서버 문구 그대로 띄운다. 여기서 또 띄우면
  // 두 개가 겹친다 — opt-out은 화면이 인라인으로 그리거나 코드별 문구가 갈릴 때만 쓴다.
  const replaceParticipants = useReplaceNoteParticipants();

  const membersData = membersResponse.data;
  const members: Member[] =
    membersData?.status === 200 && membersData.data.success
      ? membersData.data.data.members
      : [];
  // 로딩과 실패를 뭉치면 목록을 연 직후 "불러오지 못했습니다"가 먼저 뜬다.
  const membersPending = membersResponse.isPending;
  const membersFailed = !membersPending && members.length === 0;

  const saved = participants.map((participant) => participant.userId);
  /**
   * 사용자가 **실제로 골랐을 때만** 채워지는 임시 선택. 열 때 미리 채우지 않는다 —
   * 열어만 두고 닫는 동안 폴링이 다른 사람의 변경을 가져오면, 아무것도 안 건드린 사용자가
   * 열던 시점의 낡은 목록으로 그 변경을 되돌리게 된다. null이면 보낼 것이 없다는 뜻이다.
   */
  const [draft, setDraft] = useState<string[] | null>(null);
  const selectedIds = draft ?? saved;
  // combobox의 값은 멤버 객체다 — 항목에서 아바타·이메일을 바로 그려야 하기 때문이다.
  const selectedMembers = members.filter((member) =>
    selectedIds.includes(member.userId)
  );

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

      {/* 팝업이 트리거가 아니라 화면 엉뚱한 곳에 붙던 자리다. 검색 입력을 팝업 안에 두면
          기본 앵커(입력)가 팝업 자신이 되어 위치가 무너진다 — 트리거를 앵커로 명시한다. */}
      <span ref={anchorRef} className="inline-flex">
        <Combobox
          items={members}
          multiple
          value={selectedMembers}
          // 이름과 이메일을 한 문자열로 합쳐 어느 쪽으로 쳐도 걸리게 한다.
          itemToStringLabel={(member: Member) =>
            `${member.name} ${member.email}`
          }
          isItemEqualToValue={(a: Member, b: Member) => a.userId === b.userId}
          onValueChange={(next: Member[]) =>
            setDraft(next.map((member) => member.userId))
          }
          onOpenChange={(open) => {
            if (open) {
              // 종료된 노트는 폴링이 멈춰 있어 다른 사람이 바꾼 참여자가 안 들어온다.
              // 고르기 직전에 한 번 당겨 선택 상태를 최신으로 맞춘다.
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
          <ComboboxTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                // combobox 롤은 내용에서 이름을 안 가져온다 — 라벨을 명시해야 읽힌다.
                aria-label="참여자 선택"
                className="rounded-full"
                loading={replaceParticipants.isPending}
              >
                <UserPlus /> 참여자 선택
              </Button>
            }
          />
          <ComboboxContent anchor={anchorRef} align="start" className="w-72">
            <ComboboxInput
              // 이 입력도 role="combobox"라 placeholder로는 이름이 안 붙는다.
              aria-label="이름이나 이메일로 멤버 검색"
              placeholder="이름이나 이메일로 검색"
              // 바깥에 이미 트리거가 있다 — 켜 두면 같은 id의 이름 없는 트리거가 하나 더 생긴다.
              showTrigger={false}
            />
            <ComboboxEmpty>
              {membersPending
                ? "멤버를 불러오는 중입니다."
                : membersFailed
                  ? "멤버를 불러오지 못했습니다."
                  : "일치하는 멤버가 없습니다."}
            </ComboboxEmpty>
            <ComboboxList>
              {(member: Member) => (
                <ComboboxItem key={member.userId} value={member}>
                  {/* 이니셜이 옵션 이름에 섞여 "김 김민수 …"로 읽힌다 — 장식이라 숨긴다. */}
                  <span aria-hidden="true" className="contents">
                    <ParticipantAvatar
                      participant={member}
                      size="sm"
                      interactive={false}
                    />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{member.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
            {membersFailed ? (
              // 조회 훅이 목록 밖에 마운트되어 있어 닫았다 열어도 다시 안 부른다.
              <div className="border-t border-border p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => void membersResponse.refetch()}
                >
                  다시 시도
                </Button>
              </div>
            ) : null}
          </ComboboxContent>
        </Combobox>
      </span>
    </div>
  );
}
