"use client";

import { useState } from "react";
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
  useRecording,
  useRecordingMeter,
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
import { formatAppDate } from "@/lib/format/date";
import { formatRelativeTime } from "@/lib/format/relative-time";
import {
  getRecordedDurationMs,
  MEETING_STATUS_LABEL,
} from "@/lib/notes/meeting-state";
import { cn } from "@/lib/utils";

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
 * 상대 시각("방금/14분 전/어제"). `now`는 목록이 단일 시계로 내려준다 — 행마다 타이머를 두면
 * 노트가 많을 때 렌더가 폭증한다. `now`가 없으면(SSR·첫 렌더·미해결) 짧은 절대 날짜로 두어
 * 하이드레이션을 맞추고, 채워지면 상대 시각으로 교체한다.
 */
function RelativeTime({ iso, now }: { iso: string; now: number | null }) {
  return (
    <span className="shrink-0 text-xs text-[var(--el-muted)] tabular-nums">
      {now === null
        ? formatAppDate(iso, { month: "long", day: "numeric" })
        : formatRelativeTime(iso, now)}
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
      <span aria-hidden="true" className="shrink-0">
        ·
      </span>
      <RelativeTime iso={note.updatedAt} now={now} />
    </span>
  );
}

export function NoteListRow({
  workspaceId,
  note,
  now = null,
}: {
  workspaceId: string;
  note: NoteListResponseDataNotesItem;
  /** 목록이 내려주는 공용 시계. 없으면 절대 날짜 fallback. */
  now?: number | null;
}) {
  const recording = useRecording();
  const isRecording =
    (recording.activeNoteId ?? recording.session?.noteId) === note.noteId &&
    ["requesting-permission", "connecting", "recording", "stopping"].includes(
      recording.phase
    );
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

  // 목록 계약의 `meetingStartedBy`는 userId·name뿐이라 이미지가 없다 — 참여자로도 있으면
  // 거기서 이미지를 빌려 온다.
  const starter = note.meetingStartedBy
    ? ((note.participants ?? []).find(
        (participant) => participant.userId === note.meetingStartedBy?.userId
      ) ?? {
        userId: note.meetingStartedBy.userId,
        name: note.meetingStartedBy.name,
        email: "",
      })
    : null;

  const sideHref = `/w/${workspaceId}/notes/${note.noteId}?view=side&tab=details`;
  const fullHref = `/w/${workspaceId}/notes/${note.noteId}?view=full&tab=details`;

  // v5 행은 한 줄이었지만, 상태 메타를 오른쪽 끝에 몰아넣으니 행마다 구성이 달라져 세로로
  // 훑히지 않았다. 제목과 메타를 두 줄로 나눠 **메타의 시작 x를 모든 행에서 같게** 만든다.
  // 배경·카드·그림자는 그대로 없다(FORM SPEC).
  return (
    <article className="group flex h-16 items-center gap-2 rounded-control px-3 transition-colors hover:bg-[var(--el-canvas-soft)] focus-within:bg-[var(--el-canvas-soft)]">
      <Link
        href={sideHref}
        aria-label={`${note.title} 노트 열기`}
        // self-stretch로 행 전체를 클릭·포커스 영역으로 채운다(빈 위아래도 노트가 열리게).
        className="flex min-w-0 flex-1 items-center gap-[14px] self-stretch rounded-control outline-none focus-visible:ring-2 focus-visible:ring-[var(--el-ink)]"
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
        <span className="flex shrink-0 items-center gap-2">
          {starter ? (
            <>
              <ParticipantAvatar participant={starter} size="sm" isStarter />
              <span
                aria-hidden="true"
                className="h-5 w-px bg-[var(--el-hairline-strong)]"
              />
            </>
          ) : null}
          <NoteParticipantAvatars
            participants={note.participants}
            max={3}
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
              className="rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLinkItem
            href={fullHref}
            // `onNavigate`는 실제 클라이언트 이동에만 불린다 — ⌘+클릭(새 탭)에서는 안 돈다.
            // `onClick`으로 하면 새 탭을 열어도 이 탭의 스피너가 영원히 남는다.
            onNavigate={() => setOpenedFullViewFrom(routeKey)}
          >
            <Expand /> 전체 화면
          </DropdownMenuLinkItem>
          {/* 기록 중이면 서버가 409로 막는다. 눌러서 실패하게 두지 않고 항목을 안 그린다. */}
          {note.meetingStatus === "IN_PROGRESS" ? null : (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 /> 삭제
            </DropdownMenuItem>
          )}
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
}
