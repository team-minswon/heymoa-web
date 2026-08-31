"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGetWorkspaceGuestsQueryKey,
  useDeleteWorkspaceGuest,
  useGetWorkspaceGuests,
  useLinkWorkspaceGuest,
  usePreviewWorkspaceGuestLink,
} from "@/lib/api/generated/workspaces/workspaces";
import {
  isNoteQueryKey,
  isNoteTranscriptQueryKey,
  isProjectNotesQueryKey,
} from "@/lib/notes/query-keys";
import { useGetWorkspaceMembers } from "@/lib/api/generated/workspace-members/workspace-members";
import { useQueryClient } from "@tanstack/react-query";
import type {
  GuestLinkResponseData,
  WorkspaceGuestListResponseDataGuestsItem,
  WorkspaceMemberListResponseDataMembersItem,
} from "@/lib/api/generated/models";

/**
 * 워크스페이스의 임시 참여자 (APP-495).
 *
 * **멤버 목록과 섞지 않는다.** 한 목록에 세우면 역할 변경과 내보내기가 임시 참여자에게도
 * 있는 것처럼 읽힌다 — 계정이 없는 사람에게는 둘 다 뜻이 없다.
 *
 * **목록은 전원이 본다.** 참석자 후보와 화자 지정 후보를 세우는 데 쓰이고, 그 이름들은
 * 어차피 회의록에서 보인다. 관리(연동·삭제)만 ADMIN이다 — 서버가 이미 그 모양이라
 * 화면이 그대로 비추면 된다.
 */
export function WorkspaceGuestsSettings({
  workspaceId,
  canManage,
}: {
  workspaceId: string;
  canManage: boolean;
  /**
   * 회의로 옮겨 가기 직전에 부른다. **설정이 대화상자라 닫지 않으면** 이동한 화면 위에
   * 그대로 덮여 있어 사용자는 아무것도 안 일어난 것처럼 본다.
   */
}) {
  /**
   * **들어올 때 다시 읽는다.** 전역 `staleTime` 이 60초라, 다른 화면이 채운 캐시가 아직
   * fresh 면 요청 없이 그것을 그린다. 그 사이 남이 회의에서 이 사람을 빼면 `noteCount` 가
   * 낡고, 사람은 **틀린 영향 범위를 보고 되돌릴 수 없는 삭제**를 누른다.
   * 전사 화면(`note-archive`)이 같은 쿼리를 같은 이유로 이렇게 부른다.
   */
  const guestsQuery = useGetWorkspaceGuests(workspaceId, {
    query: { refetchOnMount: "always" },
  });
  /**
   * **대화상자를 목록 밖에서 연다.** 행 안에 두면, 확인창이 여는 재조회가 마침 그 행을
   * 목록에서 지우는 순간(남이 먼저 지웠다) **대화상자까지 함께 언마운트된다** — 「이미
   * 지워졌습니다」가 뜰 자리가 없어 창이 설명 없이 닫힌다.
   *
   * 고른 행을 **객체째** 들고 있는 이유도 같다. 식별자만 들면 목록에서 사라지는 순간
   * 무엇을 지우려던 것인지도 잃는다.
   */
  const [dialog, setDialog] = useState<{
    kind: "link" | "delete";
    guest: WorkspaceGuestListResponseDataGuestsItem;
  } | null>(null);

  const response = guestsQuery.data;
  const guests =
    response?.status === 200 && response.data.success
      ? (response.data.data?.guests ?? [])
      : [];

  return (
    <section className="mt-8 border-t border-[var(--el-hairline)] pt-8">
      <h3 className="text-[15px] font-semibold text-[var(--el-ink)]">
        임시 참여자
      </h3>
      <p className="mt-1.5 text-sm text-[var(--el-muted)]">
        계정 없이 회의에 참여한 사람입니다. 나중에 계정이 생기면 이어 붙일 수
        있습니다.
      </p>

      {guestsQuery.isLoading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-[52px] rounded-block" />
          <Skeleton className="h-[52px] rounded-block" />
        </div>
      ) : /* **들고 있는 목록이 있으면 실패로 덮지 않는다.** 캐시를 든 채 리패치만 실패해도
             TanStack 은 `isError` 가 된다 — 그때 목록을 오류 화면으로 바꾸면 이미 보이던
             임시 참여자와 연동·삭제가 **재시도가 성공할 때까지 통째로 사라진다.**

             `guests.length === 0` 으로 가르면 안 된다. 정상적으로 빈 목록을 캐시한 뒤 실패하면
             빈 안내 대신 오류가 뜬다 — 길이가 아니라 **응답을 든 적이 있는가**다.

             ⚠️ `200 success:false` 는 여기 안 걸린다(`isError` 가 false 다). 그 층은 앱 전체가
             정규화를 안 하고 있어 이 프로젝트 밖에서 다룬다. */
      guestsQuery.isError && guestsQuery.data === undefined ? (
        <div role="alert" className="mt-4 space-y-2">
          <p className="text-sm text-[var(--el-ink)]">
            임시 참여자를 불러오지 못했습니다.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            onClick={() => void guestsQuery.refetch()}
          >
            다시 시도
          </Button>
        </div>
      ) : guests.length === 0 ? (
        // **빈 상태는 오류가 아니다.** 한 명도 없는 것이 정상이다.
        <p className="mt-4 text-sm text-[var(--el-muted)]">
          아직 임시 참여자가 없습니다.
        </p>
      ) : (
        <>
          {/* **왜 관리가 사라졌는지 말한다.** 캐시를 든 채 리패치가 실패하면 목록은 그대로
              두되 연동·삭제를 잠그는데(확인창의 숫자가 낡을 수 있어서), 이유가 안 보이면
              ADMIN 은 **권한이 사라진 것으로 읽고** 되돌릴 길도 없다. */}
          {guestsQuery.isError && guestsQuery.data !== undefined ? (
            <div
              role="alert"
              className="mt-4 flex items-center gap-2 text-sm text-[var(--el-muted)]"
            >
              <span>
                최신 목록을 확인하지 못해 연동·삭제를 잠갔습니다.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-[30px]"
                onClick={() => void guestsQuery.refetch()}
              >
                다시 시도
              </Button>
            </div>
          ) : null}
        <ul className="mt-4 divide-y divide-[var(--el-hairline)] overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-white">
          {guests.map((guest) => (
            <GuestRow
              key={guest.guestId}
              guest={guest}
              // **낡은 값으로는 지우지 못하게 한다.** 캐시를 살려 목록은 그대로 그리지만,
              // 그 사이 남이 이 사람을 다른 회의에 넣었으면 확인창의 「회의록 N개」가 거짓이
              // 된다 — 삭제는 되돌릴 수 없고 화자 연결까지 CASCADE 로 가져간다.
              // 연동은 실행 전 미리보기가 다시 판정하지만 삭제에는 그 관문이 없다.
              canManage={
                canManage && !guestsQuery.isError && !guestsQuery.isFetching
              }
              // **열 때 다시 읽는다.** 목록의 숫자는 화면에 들어올 때 값이고, 설정을 열어
              // 둔 채 시간이 흐르면(`staleTime` 60초) 다시 안 읽는다.
              onOpen={(kind) => {
                setDialog({ kind, guest });
                void guestsQuery.refetch();
              }}
            />
          ))}
          </ul>
        </>
      )}

      {dialog?.kind === "link" ? (
        <LinkGuestDialog
          guest={dialog.guest}
          workspaceId={workspaceId}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <DeleteGuestDialog
          guest={dialog.guest}
          workspaceId={workspaceId}
          // 목록에서 사라졌으면 `undefined` — 남이 먼저 지웠다는 뜻이다.
          fresh={guests.find(
            (item) => item.guestId === dialog.guest.guestId
          )}
          settled={!guestsQuery.isFetching && !guestsQuery.isError}
          lookupFailed={guestsQuery.isError}
          onRetry={() => void guestsQuery.refetch()}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </section>
  );
}

function GuestRow({
  guest,
  canManage,
  onOpen,
}: {
  guest: WorkspaceGuestListResponseDataGuestsItem;
  canManage: boolean;
  onOpen: (kind: "link" | "delete") => void;
}) {
  return (
    <li className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--el-surface-strong)] text-[11px] text-[var(--el-ink)]">
        {[...guest.displayName][0] ?? "?"}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-[var(--el-ink)]">
          {guest.displayName}
        </span>
        <span className="text-xs text-[var(--el-muted)]">
          회의록 {guest.noteCount}개
        </span>
      </span>

      {/* **관리는 ADMIN만이다.** 목록 자체는 전원이 본다 */}
      {canManage ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-[30px]"
            onClick={() => onOpen("link")}
          >
            연동
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-[30px]"
            onClick={() => onOpen("delete")}
          >
            삭제
          </Button>
        </span>
      ) : null}
    </li>
  );
}

/**
 * 연동은 **멤버 고르기 → 미리보기 → 확인 → 실행** 넷을 지난다.
 *
 * 되돌릴 수 없어서 미리보기가 앞에서 막는 유일한 장치다. 되돌리기를 안 만들기로 한 근거가
 * 그것이므로, 미리보기를 건너뛰는 길을 두지 않는다.
 */
function LinkGuestDialog({
  guest,
  workspaceId,
  onClose,
}: {
  guest: WorkspaceGuestListResponseDataGuestsItem;
  workspaceId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  /**
   * **대화상자를 열 때 다시 읽는다.** 이 대화상자는 조건부 렌더라 열릴 때 마운트된다.
   * `MembersSettings` 가 같은 쿼리를 이미 구독하므로 캐시가 fresh 면 그대로 재사용되는데,
   * 그러면 그 사이 들어온 멤버를 **연동 대상으로 고를 수 없다**.
   *
   * 부모에서 내리지 않고 여기서 다시 읽는 이유 — 목록은 낡아도 되지만 **고르는 자리는
   * 안 된다**. 키가 같아 요청이 아니라 관측자가 하나 는 것이고, 갱신 시점이 서로 다르다.
   */
  const membersQuery = useGetWorkspaceMembers(workspaceId, {
    query: { refetchOnMount: "always" },
  });
  const preview = usePreviewWorkspaceGuestLink();
  const link = useLinkWorkspaceGuest();

  const [target, setTarget] =
    useState<WorkspaceMemberListResponseDataMembersItem | null>(null);
  const [plan, setPlan] = useState<GuestLinkResponseData | null>(null);
  /** 실행 결과. 미리보기와 다를 수 있어 **따로 들고** 그린다. */
  const [result, setResult] = useState<GuestLinkResponseData | null>(null);

  const membersResponse = membersQuery.data;
  const members =
    membersResponse?.status === 200 && membersResponse.data.success
      ? (membersResponse.data.data?.members ?? [])
      : [];
  /**
   * **멤버를 못 불러온 것과 멤버가 없는 것을 가른다.** 뭉치면 이을 계정을 못 고르는 채로
   * 빈 목록만 남고, 사람은 무엇이 잘못됐는지도 모른 채 창을 닫는다.
   *
   * 워크스페이스에는 최소한 부른 사람(ADMIN)이 있으므로 빈 목록은 실패로 봐도 된다.
   */
  const membersPending = membersQuery.isPending;
  /**
   * **실패는 캐시가 있어도 실패다.** 배경 재조회가 깨지면 `isError` 인데 캐시 길이가
   * 양수라, 길이만 보면 「멀쩡한 목록」으로 읽힌다.
   */
  const membersFailed =
    !membersPending && (membersQuery.isError || members.length === 0);
  /**
   * **고를 수 있나는 그릴 수 있나와 다르다.** `refetchOnMount: "always"` 가 도는 동안에도
   * `isPending` 은 false 다 — 캐시가 있으니까. 그때 고르면 이미 나간 멤버가 눌리고,
   * 미리보기가 404 로 끊긴다. 목록은 고르는 자리 그 자체라 확정 전에는 안 연다.
   */
  const membersSettled = !membersQuery.isFetching && !membersQuery.isError;

  async function choose(member: WorkspaceMemberListResponseDataMembersItem) {
    setTarget(member);
    try {
      const response = await preview.mutateAsync({
        workspaceId,
        guestId: guest.guestId,
        data: { targetUserId: member.userId },
      });
      if (response.status !== 200 || !response.data.success) return;
      setPlan(response.data.data);
    } catch {
      // 실패 토스트는 전역이 서버 문구 그대로 띄운다.
      setTarget(null);
    }
  }

  async function run() {
    if (!target) return;
    try {
      const response = await link.mutateAsync({
        workspaceId,
        guestId: guest.guestId,
        data: { targetUserId: target.userId },
      });
      if (response.status !== 200 || !response.data.success) return;
      setResult(response.data.data);
      /**
       * **바뀐 것을 전부 다시 읽는다.**
       *
       * 예전에는 응답의 `changedNotes`만 짚었는데, 그 목록은 **100건에서 잘린다** — 회의가
       * 그보다 많으면 나머지가 옛 이름을 들고 남는다. 노트 목록도 참여자 이름·아바타를
       * 그리므로 함께 낡는다.
       *
       * 이 화면이 대화상자라 뒤에 회의록이 떠 있는 것이 흔한 상태다. 사람은 옛 이름을 보고
       * 연동이 안 된 것으로 읽는다.
       */
      await Promise.all([
        queryClient.invalidateQueries({ predicate: isNoteQueryKey }),
        queryClient.invalidateQueries({ predicate: isNoteTranscriptQueryKey }),
        queryClient.invalidateQueries({
          predicate: (query) => isProjectNotesQueryKey(query.queryKey),
        }),
      ]);
    } catch {
      /**
       * **계획을 버리고 고르는 자리로 되돌린다.** `CONCURRENT_GUEST_LINK` 는 그 사이 이 사람이
       * 회의에 더 들어갔다는 뜻이라 **손에 든 미리보기가 이미 틀렸다.** `target` 과 `plan` 을
       * 남기면 「연동」이 다시 눌리고, 두 번째 요청은 성공해 **낡은 미리보기를 확인한 채
       * 되돌릴 수 없는 변경**이 나간다.
       */
      setPlan(null);
      setTarget(null);
      return;
    }
  }

  /**
   * **목록 갱신은 닫을 때다.** 연동이 끝나면 그 사람이 목록에서 사라지는데, 이 대화상자가
   * 그 행 안에 살고 있어서 곧바로 무효화하면 **결과를 읽기도 전에 함께 사라진다.**
   */
  async function finish() {
    onClose();
    await queryClient.invalidateQueries({
      queryKey: getGetWorkspaceGuestsQueryKey(workspaceId),
    });
  }

  // **되돌릴 수 없는 요청이 도는 동안에는 못 닫는다.** 닫아도 요청은 계속 가서 연동이
  // 끝나는데, 결과 화면만 사라져 무엇이 바뀌었는지 볼 길이 없어진다.
  const pending = preview.isPending || link.isPending;

  const shown = result ?? plan;

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (open || pending) return;
        void finish();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {result
              ? `${guest.displayName} 연동 결과`
              : `${guest.displayName}을(를) 계정과 연동`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {result
              ? "연동이 끝났습니다."
              : target
                ? // **이름만으로는 어느 계정인지 말할 수 없다.** 표시 이름은 OAuth 에서 와
                  // 유일하지 않고, 연동은 되돌릴 수 없다. 고르는 목록이 이메일을 함께
                  // 그리는 이유가 그것이라 확인 단계도 같은 식별자를 쓴다.
                  `${target.name}(${target.email}) 계정으로 잇습니다.`
                : "이 사람을 어느 멤버와 이을지 고릅니다."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!target && membersFailed ? (
          <div role="alert" className="space-y-2 text-sm">
            <p className="text-[var(--el-ink)]">멤버를 불러오지 못했습니다.</p>
            <Button
              variant="outline"
              size="sm"
              className="h-[30px]"
              onClick={() => void membersQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        ) : !target && (membersPending || !membersSettled) ? (
          <Skeleton className="h-24 rounded-block" />
        ) : !target ? (
          <ul className="max-h-64 divide-y divide-[var(--el-hairline)] overflow-y-auto rounded-block border border-[var(--el-hairline)]">
            {members.map((member) => (
              <li key={member.userId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--el-canvas-soft)]"
                  onClick={() => void choose(member)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {member.name}
                    </span>
                    <span className="block truncate text-xs text-[var(--el-muted)]">
                      {member.email}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : preview.isPending ? (
          <Skeleton className="h-24 rounded-block" />
        ) : shown ? (
          <LinkPlanSummary plan={shown} executed={result !== null} />
        ) : null}

        <AlertDialogFooter>
          {result ? (
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void finish();
              }}
            >
              확인
            </AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel disabled={pending} onClick={onClose}>
                취소
              </AlertDialogCancel>
              {target && shown ? (
                <AlertDialogAction
                  // base-ui는 action을 누르면 닫는다 — 실행 결과를 보여줘야 하므로 막는다.
                  onClick={(event) => {
                    event.preventDefault();
                    void run();
                  }}
                  // **children 을 안 바꾼다.** `Button` 이 보존하는 것은 자기가 받은
                  // children 의 폭이라, 문구를 갈아 끼우면 버튼과 footer 가 요청 중에 흔들린다.
                  loading={link.isPending}
                  disabled={pending}
                >
                  연동
                </AlertDialogAction>
              ) : null}
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * 무엇이 바뀌는가.
 *
 * **미리보기 숫자를 최종 결과로 쓰지 않는다.** 미리보기와 실행 사이에 다른 사람이 화자를
 * 고치면 숫자가 달라지고, 그러면 사람이 본 것과 일어난 일이 어긋난다.
 *
 * **건너뛰는 회의가 없다** (V31). APP-492 는 그 계정이 이미 다른 화자에 붙어 있으면 그 회의를
 * 건너뛰고 어느 회의인지 여기에 세워, 사람이 가서 판단하게 했다. 이제는 양쪽 화자를 그대로
 * 들고 합치므로 판단할 것이 없다.
 */
function LinkPlanSummary({
  plan,
  executed,
}: {
  plan: GuestLinkResponseData;
  executed: boolean;
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-[var(--el-ink)]">
        회의록 {plan.changedNoteCount}개가{" "}
        {executed ? "바뀌었습니다" : "바뀝니다"}.
      </p>

      {/* **어느 회의인지 이름으로 보여준다.** 되돌릴 수 없는데 개수만 보면, 같은 이름의 임시
          참여자가 여럿일 때 **엉뚱한 사람을 잇는 것을 누르기 전에 알 방법이 없다.** */}
      {plan.changedNotes.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-[var(--el-muted)]">
          {plan.changedNotes.map((note) => (
            <li key={note.noteId} className="truncate">
              {note.title}
            </li>
          ))}
        </ul>
      ) : null}

      {/* 개수는 안 자르고 목록만 자른다 — 둘이 다르면 잘린 것이다 (계약) */}
      {plan.changedNoteCount > plan.changedNotes.length ? (
        <p className="text-[var(--el-muted-soft)]">
          최근 {plan.changedNotes.length}개만 보여줍니다.
        </p>
      ) : null}

      {!executed ? (
        <p className="flex items-start gap-1.5 text-[var(--el-danger)]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>되돌릴 수 없습니다.</span>
        </p>
      ) : null}
    </div>
  );
}

/** 삭제도 되돌릴 수 없다 — **쓰이고 있는 회의록 수를 먼저 보여준다.** */
/**
 * **영향 범위는 부모가 읽어서 내린다.** 여기서 따로 구독하면 그 재조회가 부모 목록을
 * 갱신하고, 마침 이 사람이 사라지는 순간 **자기를 그리던 행과 함께 언마운트된다.**
 * 그래서 부모가 열 때 다시 읽고 결과만 넘긴다.
 */
function DeleteGuestDialog({
  guest,
  workspaceId,
  fresh,
  settled,
  lookupFailed,
  onRetry,
  onClose,
}: {
  guest: WorkspaceGuestListResponseDataGuestsItem;
  workspaceId: string;
  /** 다시 읽은 결과. `undefined` 면 목록에서 사라졌다 — 남이 먼저 지웠다. */
  fresh: WorkspaceGuestListResponseDataGuestsItem | undefined;
  settled: boolean;
  lookupFailed: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const remove = useDeleteWorkspaceGuest();
  const goneAlready = settled && fresh === undefined;
  /** 확인 못 했으면 **손에 든 옛 숫자**를 쓰되, 그때는 삭제를 안 연다. */
  const noteCount = fresh?.noteCount ?? guest.noteCount;

  async function run() {
    try {
      await remove.mutateAsync({ workspaceId, guestId: guest.guestId });
    } catch {
      return;
    }
    // **이 사람이 나온 회의도 전부 다시 읽는다.** 삭제는 그 회의들의 참여 기록과 화자
    // 연결까지 지우는데(응답이 어느 회의였는지는 안 준다), 목록만 갱신하면 뒤에 떠 있는
    // 회의록이 사라진 사람을 계속 그린다.
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetWorkspaceGuestsQueryKey(workspaceId),
      }),
      queryClient.invalidateQueries({ predicate: isNoteQueryKey }),
      queryClient.invalidateQueries({ predicate: isNoteTranscriptQueryKey }),
      queryClient.invalidateQueries({
        predicate: (query) => isProjectNotesQueryKey(query.queryKey),
      }),
    ]);
    onClose();
  }

  return (
    <AlertDialog
      open
      // 되돌릴 수 없는 요청이 도는 동안에는 못 닫는다 — 연동 대화상자와 같은 규칙이다.
      onOpenChange={(open) => {
        if (open || remove.isPending) return;
        onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {guest.displayName}을(를) 삭제할까요?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {lookupFailed
              ? "영향 범위를 확인하지 못했습니다. 몇 개의 회의록이 바뀌는지 모르는 채로는 지우지 않습니다."
              : goneAlready
                ? "이미 지워졌습니다. 다른 사람이 먼저 지운 것 같습니다."
                : !settled
                  ? "영향 범위를 확인하고 있습니다…"
                  : `회의록 ${noteCount}개에서 이 사람이 사라지고, 붙어 있던 화자 연결도 함께 풀립니다. 되돌릴 수 없습니다.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {lookupFailed ? (
          <div role="alert">
            <Button
              variant="outline"
              size="sm"
              className="h-[30px]"
              onClick={onRetry}
            >
              다시 시도
            </Button>
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending} onClick={onClose}>
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void run();
            }}
            loading={remove.isPending}
            disabled={!settled || goneAlready}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
