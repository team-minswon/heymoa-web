"use client";

import { track } from "@/lib/analytics/track";

import { memo, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Expand,
  FileText,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

import {
  useRecordingMeter,
  useRecordingNoteId,
} from "@/components/transcription/recording-provider";
import { NoteDeleteDialog } from "@/components/notes/note-delete-dialog";
import {
  NoteParticipantAvatars,
  ParticipantAvatar,
} from "@/components/notes/note-participants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteListResponseDataNotesItem } from "@/lib/api/generated/models";
import {
  getRecordedDurationMs,
  MEETING_STATUS_LABEL,
} from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";

/**
 * 행이 「열린」 상태일 때만 켜지는 변형. 아바타가 `…` 폭만큼 왼쪽으로 비키고 `…` 가 나타난다.
 * 포인터 hover, **키보드 포커스**(`:focus-visible` — 마우스로 누른 포커스는 제외), 메뉴가 열려 있는
 * 동안(`aria-expanded`), 아바타 툴팁이 열려 있는 동안(`data-popup-open` — 툴팁은 포털이라 포인터가 거기 닿으면 행 hover 가 풀린다), 그리고 hover 가 없는 터치 환경에서 늘 켠다.
 * Tailwind 는 클래스를 정적 문자열로만 읽으므로 두 곳에서 같은 목록을 그대로 쓴다.
 */
const SHIFT_WHEN_OPEN =
  "group-hover/row:-translate-x-9 group-has-[:focus-visible]/row:-translate-x-9 group-has-[[aria-expanded=true]]/row:-translate-x-9 group-has-[[data-popup-open]]/row:-translate-x-9 [@media(hover:none)]:-translate-x-9";
const REVEAL_WHEN_OPEN =
  "group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-has-[:focus-visible]/row:pointer-events-auto group-has-[:focus-visible]/row:opacity-100 group-has-[[aria-expanded=true]]/row:pointer-events-auto group-has-[[aria-expanded=true]]/row:opacity-100 group-has-[[data-popup-open]]/row:pointer-events-auto group-has-[[data-popup-open]]/row:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100";

function ActiveRecordingMeter({ title }: { title: string }) {
  const meter = useRecordingMeter();

  return (
    <div
      role="meter"
      aria-label={`${title} 마이크 입력`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(
        Math.max(...meter.levelHistory.slice(-5), 0) * 100
      )}
      className="flex h-4 w-5 items-center justify-center gap-[2px]"
    >
      {meter.levelHistory.slice(-4).map((sample, index) => (
        <span
          key={index}
          className="h-3.5 w-[2px] origin-center rounded-full bg-destructive transition-transform duration-75"
          style={{ transform: `scaleY(${Math.max(0.16, sample)})` }}
        />
      ))}
    </div>
  );
}

function NoteRowIcon({
  title,
  isRecording,
  forcePending = false,
}: {
  title: string;
  isRecording: boolean;
  /** 메뉴의 `전체 화면으로 열기`처럼 이 링크 밖에서 시작된 이동. */
  forcePending?: boolean;
}) {
  const { pending } = useLinkStatus();
  const isPending = pending || forcePending;

  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center",
        isRecording ? "text-destructive" : "text-[var(--el-muted-soft)]"
      )}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : isRecording ? (
        <ActiveRecordingMeter title={title} />
      ) : (
        <FileText className="size-4" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * 행의 둘째 줄. **모든 행이 같은 항목을 같은 순서로** 왼쪽 정렬로 낸다.
 *
 * 예전에는 한 줄 오른쪽 끝에 몰아넣고 상태마다 항목을 갈랐다 — 진행자는 중지됨에만,
 * 상대 시각은 종료됨에만 떠서 행마다 길이도 구성도 달랐고, 오른쪽 정렬이라 시작 x까지
 * 어긋나 **세로로 훑을 수가 없었다.** 브레이크포인트별 숨김(`hidden sm:`·`md:`)도 같은
 * 불일치를 화면 폭마다 다시 만들었다.
 *
 * 기록 시간은 회의를 시작한 적이 있을 때만 쓴다 — 시작 전의 `0분`은 사실이 아니라 빈칸이다.
 *
 * **마지막으로 고친 시각(`13시간 전`)은 걷어냈다**(APP-410). 이 목록에서 찾는 값이 아니고,
 * 제목만 고쳐도 바뀌어서 날짜 머리글과 어긋났다 — 7월 27일 묶음의 행이 `15분 전`으로 보였다.
 * 회의가 언제였나는 위의 날짜 머리글이 말한다.
 *
 * 사람 수는 글자로 적고 얼굴은 오른쪽 아바타가 맡는다. 진행자는 그 아바타 줄에서
 * 구분선으로 갈라 세운다(`진행자 | 참여자들`) — 이름까지 여기 적으면 같은 사실이 두 곳에
 * 나고 줄이 길어져 제목을 밀어낸다.
 */
function MeetingMeta({
  note,
  now,
}: {
  note: NoteListResponseDataNotesItem;
  now: number | null;
}) {
  const status = note.meetingStatus;
  const minutes = Math.floor(getRecordedDurationMs(note, now ?? 0) / 60_000);
  // 계약상 필수지만 배포 직후 남은 옛 응답·캐시에는 없을 수 있다. 여기서 그냥 `.length`를
  // 읽으면 아바타 하나 때문에 **노트 목록 전체가 빈 화면**이 된다(`NoteParticipantAvatars`가
  // 같은 이유로 기본값을 두는데, 이 줄이 그보다 먼저 돈다).
  const participantCount = note.participants?.length ?? 0;

  return (
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs text-[var(--el-muted)]">
      {status === "IN_PROGRESS" ? (
        <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
      ) : null}
      <span
        className={cn(
          "shrink-0 font-medium",
          status === "IN_PROGRESS" && "text-destructive"
        )}
      >
        {MEETING_STATUS_LABEL[status]}
      </span>
      {status !== "NOT_STARTED" ? (
        <>
          <span aria-hidden="true" className="shrink-0">
            ·
          </span>
          <span className="shrink-0 tabular-nums">기록 {minutes}분</span>
        </>
      ) : null}
      {participantCount > 0 ? (
        <>
          <span aria-hidden="true" className="shrink-0">
            ·
          </span>
          <span className="shrink-0 tabular-nums">
            참여 {participantCount}명
          </span>
        </>
      ) : null}
    </span>
  );
}

export const NoteListRow = memo(function NoteListRow({
  workspaceId,
  note,
  now = null,
  arrived = false,
}: {
  workspaceId: string;
  note: NoteListResponseDataNotesItem;
  /** 목록이 내려주는 공용 시계. 없으면 절대 날짜 fallback. */
  now?: number | null;
  /** 「더 보기」로 방금 이어 붙은 행. 짧게 옅은 데서 들어온다 — 자리는 처음부터 잡혀 있어 아래가 밀리지 않는다. */
  arrived?: boolean;
}) {
  const isRecording = useRecordingNoteId() === note.noteId;
  // `전체 화면으로 열기`는 메뉴 안에 있고, 누르면 메뉴가 닫히며 그 안의 표시도 사라진다.
  // 그래서 진행 상태를 포털 밖(이 행)에 둔다.
  //
  // **누른 시점의 위치를 기억해 렌더 중 비교한다.**
  // 쿼리까지 보는 이유는 같은 노트에서 side → full이면 경로가 안 바뀌기 때문이다.
  // 테스트 환경에는 라우터가 없어 `useSearchParams()`가 null이다.
  const routeKey = `${usePathname()}?${useSearchParams()?.toString() ?? ""}`;
  const [openedFullViewFrom, setOpenedFullViewFrom] = useState<string | null>(
    null
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  // **떠날 때 기억을 버려야 한다.** 예전에는 "위치가 달라지면 저절로 꺼진다"고만 두었는데,
  // 그건 떠날 때만 맞았다. 값이 남아 있으면 **그 위치로 돌아왔을 때 다시 같아져** 스피너가
  // 켜지고, 노트를 닫는 것이 바로 그 위치로 돌아오는 동작이라 목록 행이 영원히 돌았다(APP-243).
  // effect가 아니라 렌더 중 조정이다 — 커밋 전에 다시 렌더되므로 중간 상태가 화면에 안 나간다.
  if (openedFullViewFrom !== null && openedFullViewFrom !== routeKey) {
    setOpenedFullViewFrom(null);
  }
  const openingFullView = openedFullViewFrom === routeKey;

  const sideHref = `/w/${workspaceId}/notes/${note.noteId}?view=side&tab=details`;
  const fullHref = `/w/${workspaceId}/notes/${note.noteId}?view=full&tab=details`;

  // v5 행은 한 줄이었지만, 상태 메타를 오른쪽 끝에 몰아넣으니 행마다 구성이 달라져 세로로
  // 훑히지 않았다. 제목과 메타를 두 줄로 나눠 **메타의 시작 x를 모든 행에서 같게** 만든다.
  // 배경·카드·그림자는 그대로 없다(FORM SPEC).
  return (
    // **포커스 링은 행이 그린다.** 링을 안쪽 `<Link>`에 두면 그 링크가 행보다 좁아서
    // (오른쪽 `⋯` 메뉴가 링크 밖에 있다) 선이 행 오른쪽 끝에 못 닿고 메뉴 앞에서 끊긴다 —
    // hover 배경은 행 전체를 덮으니 같은 자리가 두 가지 크기로 보였다.
    // 조건은 여전히 링크의 `:focus-visible`이다(`has-*`) — 메뉴 버튼에 포커스가 갈 때는
    // 그 버튼의 링이 따로 있으므로 행까지 두르면 링이 두 겹이 된다.
    <article
      className={cn(
        "group/row relative flex h-16 items-center gap-2 rounded-control px-3 transition-colors hover:bg-[var(--el-canvas-soft)] focus-within:bg-[var(--el-canvas-soft)] has-[[data-popup-open]]:bg-[var(--el-canvas-soft)] has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-[var(--el-ink)] has-[a:focus-visible]:ring-inset",
        arrived &&
          "animate-in fade-in-0 duration-200 ease-out motion-reduce:animate-none"
      )}
    >
      <Link
        href={sideHref}
        onClick={() =>
          track("note_opened", {
            workspace_id: workspaceId,
            view: "side",
            source: "list",
          })
        }
        aria-label={`${note.title} 노트 열기`}
        // self-stretch로 행 전체를 클릭·포커스 영역으로 채운다(빈 위아래도 노트가 열리게).
        className="flex min-w-0 flex-1 items-center gap-[14px] self-stretch rounded-control outline-none"
      >
        <NoteRowIcon
          title={note.title}
          isRecording={isRecording}
          forcePending={openingFullView}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="min-w-16 truncate text-read font-medium text-[var(--el-ink)]">
            {note.title}
          </h3>
          <MeetingMeta note={note} now={now} />
        </span>
        {/* 진행자는 이 뭉치 안에서 배지로 구분된다 — 따로 세우면 라벨 없는 아바타 뭉치가
            둘이 되어 어느 쪽이 무엇인지 알 수 없다. */}
        {/* `진행자 | 참여자들`. 구분선이 두 뭉치의 뜻을 가른다 — 한 줄에 섞으면 어느 얼굴이
            무엇인지 알 수 없고, 배지로 표시해 봤자 이 크기에서는 점으로만 보인다.
            화면 폭으로 접지 않는다 — 접으면 모바일에서 진행자를 알 방법이 사라진다. */}
        {/* 오른쪽 끝에 붙어 있다가 행이 열리면 `…` 폭(28px) + 간격(8px) = 36px 만큼 왼쪽으로
            비킨다. `ml-9` 는 그 36px 을 **미리 제목 쪽에서 비워 두는 몫**이다 — 안 그러면
            비킨 아바타가 말줄임된 제목 끝을 덮는다. 이동은 transform 이라 레이아웃은 안 흔들린다. */}
        <span
          data-slot="note-row-people"
          className={cn(
            "ml-9 flex shrink-0 items-center gap-2 transition-transform duration-200 ease-out motion-reduce:transition-none",
            SHIFT_WHEN_OPEN
          )}
        >
          {note.meetingStartedBy ? (
            <>
              <ParticipantAvatar
                participant={note.meetingStartedBy}
                size="sm"
                isStarter
              />
              <span
                aria-hidden="true"
                className="h-5 w-px bg-[var(--el-hairline-strong)]"
              />
            </>
          ) : null}
          <NoteParticipantAvatars
            participants={note.participants}
            max={4}
            size="sm"
          />
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${note.title} 노트 메뉴`}
              data-slot="note-row-menu"
              // 숨겨진 동안은 클릭도 받지 않는다 — 오른쪽 끝의 링크 영역을 가리지 않게.
              // 키보드 포커스는 그대로 닿고(탭 순서 불변), 포커스되면 위 REVEAL 로 나타난다.
              className={cn(
                "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-full opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
                REVEAL_WHEN_OPEN
              )}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLinkItem
            href={fullHref}
            onClick={() =>
              track("note_opened", {
                workspace_id: workspaceId,
                view: "full",
                source: "list",
              })
            }
            // `onNavigate`는 실제 클라이언트 이동에만 불린다 — ⌘+클릭(새 탭)에서는 안 돈다.
            // `onClick`으로 하면 새 탭을 열어도 이 탭의 스피너가 영원히 남는다.
            onNavigate={() => setOpenedFullViewFrom(routeKey)}
          >
            <Expand /> 전체 화면
          </DropdownMenuLinkItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 /> 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NoteDeleteDialog
        noteId={note.noteId}
        projectId={note.projectId}
        title={note.title}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </article>
  );
});
