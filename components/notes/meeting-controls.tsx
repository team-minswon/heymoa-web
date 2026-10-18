"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CalendarDays,
  CircleCheck,
  CircleStop,
  FileText,
  Pause,
  Users,
} from "lucide-react";

import { MeetingEndDialog } from "@/components/notes/meeting-end-dialog";
import {
  isNoteRecordingActive,
  useRecording,
} from "@/components/transcription/recording-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NoteResponseData } from "@/lib/api/generated/models";
import type { NoteResponseDataMeetingStatus } from "@/lib/api/generated/models";
import { MEETING_STATUS_LABEL } from "@/lib/notes/meeting-state";
import { useAuthUserId } from "@/components/auth/auth-provider";
import { readUserFlag, writeUserFlag } from "@/lib/storage/user-flags";
import { cn } from "@/lib/utils";

/**
 * 회의 상태 칩. design.pen `u3yYCX`/`XtEMZ`의 Note Header 첫 줄 — 6px 점 또는 아이콘 하나에
 * 11px semibold 라벨이 붙는다. 배경 없는 칩이라 프로젝트 pill과 나란히 놓여도 안 싸운다.
 *
 * **기록 중만 붉다.** 나머지는 muted다 — 종료·중지·시작 전은 사건이 아니라 상태다.
 * 라벨은 `MEETING_STATUS_LABEL`을 그대로 쓴다(목록 행과 같은 이름). 정본은 「예정」이라고
 * 적혀 있지만 목록이 「시작 전」으로 부르는 같은 상태라, 화면마다 다르게 부르지 않는다.
 */
export function MeetingStatusChip({
  status,
}: {
  status: NoteResponseDataMeetingStatus;
}) {
  const live = status === "IN_PROGRESS";
  const Icon =
    status === "NOT_STARTED"
      ? CalendarDays
      : status === "PAUSED"
        ? Pause
        : null;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-[11px] font-semibold",
        live ? "text-destructive" : "text-[var(--el-muted)]"
      )}
    >
      {Icon ? (
        <Icon className="size-3.5" aria-hidden />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            live ? "bg-destructive" : "bg-[var(--el-muted)]"
          )}
        />
      )}
      {MEETING_STATUS_LABEL[status]}
    </span>
  );
}

/** 말풍선이 떠 있는 시간. 읽을 시간이라 길게 잡되, 놓쳐도 요약 탭이 같은 안내를 한다. */
const NUDGE_MS = 15_000;

/** 「다시 보지 않기」를 누른 사용자인가. 사용자를 모르면 안내하지 않는다. */
function nudgeSuppressed(userId: string | undefined) {
  return !userId || readUserFlag(userId, "endNudgeOff") === "1";
}

const NUDGE_ITEMS = [
  { icon: Users, title: "화자 분리", body: "누가 말했는지 나눠 이름을 붙여요" },
  { icon: FileText, title: "요약", body: "결정과 할 일을 한 번에 정리해요" },
  { icon: CircleCheck, title: "검토 완료", body: "프로젝트 지식으로 확정해요" },
] as const;

/**
 * 회의를 중지한 **직후**에만 뜨는 안내. 운영에서 중지만 하고 종료하지 않는 사람이 많았다 — 종료해야
 * 화자 분리·요약·검토가 생긴다는 것을 그 순간에 말한다. 「나중에」는 그냥 닫는 것이고(회의를 이어
 * 하겠다는 뜻이 아니다), 「다시 보지 않기」만 기억한다.
 */
function EndNudge({
  onLater,
  onEnd,
  onNever,
}: {
  onLater: () => void;
  onEnd: () => void;
  onNever: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      role="status"
      data-testid="end-nudge"
      // 툭 나오고 툭 사라지지 않게 — 버튼 쪽(오른쪽 위)에서 부드럽게 펴지고 접힌다.
      initial={reduced ? false : { opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={{ transformOrigin: "top right" }}
      // 헤더 하단선에 붙어 보이지 않게 18px 내려 띄운다. **`overflow-hidden` 을 걸지 않는다** — 화살표가
      // 말풍선 밖으로 튀어나와 있어 잘린다. 카운트다운 막대만 안쪽 래퍼가 자른다.
      className="absolute top-[calc(100%+18px)] right-0 z-50 w-80 rounded-block border border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)] shadow-xl"
    >
      <span
        aria-hidden
        className="absolute -top-[7px] right-10 size-3 rotate-45 border-t border-l border-[var(--el-hairline-strong)] bg-[var(--el-surface-card)]"
      />
      <div className="p-4">
        <p className="text-sm font-medium text-[var(--el-ink)]">
          녹음을 멈췄어요. 이제 마무리할까요?
        </p>
        <ul className="mt-3 grid gap-2.5">
          {NUDGE_ITEMS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-2.5 text-xs leading-snug">
              <Icon
                className="mt-0.5 size-4 shrink-0 text-[var(--el-ink)]"
                aria-hidden
              />
              <span className="text-[var(--el-muted)]">
                <b className="font-medium text-[var(--el-ink)]">{title}</b> —{" "}
                {body}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--el-hairline)] px-4 py-3">
        <Button type="button" variant="outline" size="sm" onClick={onLater}>
          나중에
        </Button>
        <Button type="button" size="sm" onClick={onEnd}>
          지금 종료
        </Button>
        <button
          type="button"
          onClick={onNever}
          className="ml-auto text-[11px] text-[var(--el-muted-soft)] underline underline-offset-2 hover:text-[var(--el-ink)]"
        >
          다시 보지 않기
        </button>
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-block motion-reduce:hidden"
      >
        <span
          className="block h-full bg-[var(--el-ink)]"
          style={{
            animation: `end-nudge-countdown ${NUDGE_MS}ms linear forwards`,
          }}
        />
      </div>
    </motion.div>
  );
}

/**
 * 회의 제어. design.pen의 Meeting Bar는 **회의 종료 하나뿐이다** — 상태 칩은 헤더 첫 줄로,
 * 초 단위 타이머는 레코더 독(`qYRCW`)으로 갔다. 예전에는 이 그룹이 상태 배지·누적 타이머·
 * 시작자 아바타까지 들고 있어서 조용한 헤더에서 이 줄만 소리쳤다.
 */
export function MeetingControls({
  note,
  onMeetingEnded,
  onEditParticipants,
}: {
  note: NoteResponseData;
  /** 종료 확인창의 「참여자 지정하러 가기」 — note-panel이 정보 탭으로 넘긴다. */
  onEditParticipants?: () => void;
  /** 종료 접수 후 호출 — note-panel이 요약 탭으로 넘긴다. */
  onMeetingEnded?: () => void;
}) {
  const [endOpen, setEndOpen] = useState(false);
  const recording = useRecording();
  const userId = useAuthUserId();
  const reasonId = useId();
  // **이 화면에서 기록 중 → 중지됨으로 바뀐 순간에만** 안내를 띄운다. 열어 보니 이미 중지된
  // 노트에서 매번 뜨면 잔소리다.
  const [prevStatus, setPrevStatus] = useState(note.meetingStatus);
  const [nudge, setNudge] = useState(false);
  if (note.meetingStatus !== prevStatus) {
    setPrevStatus(note.meetingStatus);
    setNudge(
      prevStatus === "IN_PROGRESS" &&
        note.meetingStatus === "PAUSED" &&
        !nudgeSuppressed(userId)
    );
  }
  useEffect(() => {
    if (!nudge) return;
    const timer = window.setTimeout(() => setNudge(false), NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [nudge]);

  const canEnd =
    note.meetingStatus === "IN_PROGRESS" || note.meetingStatus === "PAUSED";

  if (!canEnd) return null;

  // 기록 중인 회의는 서버가 409 MEETING_RECORDING 으로 거절한다(APP-694). 활성 세션 없이
  // IN_PROGRESS 로 남은 회의(시작만 누르고 연결 못 함)는 서버가 받으므로 막지 않는다.
  const recordingBlocked =
    note.meetingStatus === "IN_PROGRESS" &&
    (note.activeSessionStartedAt != null ||
      isNoteRecordingActive(recording, note.noteId));
  const recorder =
    isNoteRecordingActive(recording, note.noteId) || !note.meetingStartedBy
      ? null
      : note.meetingStartedBy.name;
  const blockedReason = recorder
    ? `${recorder} 님이 기록 중 — 중지한 뒤 종료할 수 있습니다`
    : "중지한 뒤 종료할 수 있습니다";

  // 중지됨이면 종료가 다음 할 일이다 — 채워진 주 버튼으로 바꾼다. 기록 중(막힌 상태)은 붉은 외곽선 그대로.
  const paused = note.meetingStatus === "PAUSED";
  const endButton = (
    <Button
      type="button"
      variant={paused ? "default" : "outline"}
      // design.pen `Dpy5O`: h32 · r8 · 12px. 기록 중에는 destructive 테두리와 글자(정본)이고,
      // 중지됨에서는 채워진 주 버튼이다(APP-1172).
      className={cn(
        "relative h-8 gap-1.5 rounded-control px-2.5 text-xs",
        !paused && "border-destructive text-destructive hover:text-destructive"
      )}
      disabled={recordingBlocked}
      aria-describedby={recordingBlocked ? reasonId : undefined}
      onClick={() => setEndOpen(true)}
    >
      <CircleStop className="size-4" />
      회의 종료
      {nudge ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[12px] border-[1.5px] border-[var(--el-ink)] opacity-0 motion-reduce:hidden"
          style={{ animation: "end-nudge-ring 2.2s ease-out 3" }}
        />
      ) : null}
    </Button>
  );

  return (
    <div
      role="group"
      aria-label="회의 상태 및 제어"
      className="flex shrink-0 items-center gap-3"
    >
      {recordingBlocked ? (
        <Tooltip>
          {/* disabled 버튼은 포인터 이벤트를 안 내서 감싼 span 이 툴팁을 연다. */}
          <TooltipTrigger
            delay={0}
            render={<span tabIndex={0} className="inline-flex" />}
          >
            {endButton}
          </TooltipTrigger>
          <TooltipContent>{blockedReason}</TooltipContent>
          <span id={reasonId} hidden>
            {blockedReason}
          </span>
        </Tooltip>
      ) : (
        <div className="relative">
          {endButton}
          <AnimatePresence>
            {nudge ? (
              <EndNudge
                onLater={() => setNudge(false)}
                onEnd={() => {
                  setNudge(false);
                  setEndOpen(true);
                }}
                onNever={() => {
                  // 저장 못 해도 이번 안내만 닫는다.
                  if (userId) writeUserFlag(userId, "endNudgeOff", "1");
                  setNudge(false);
                }}
              />
            ) : null}
          </AnimatePresence>
        </div>
      )}
      <MeetingEndDialog
        noteId={note.noteId}
        meetingStatus={note.meetingStatus}
        participants={note.participants}
        open={endOpen}
        onOpenChange={setEndOpen}
        onEnded={onMeetingEnded}
        onEditParticipants={onEditParticipants}
      />
    </div>
  );
}
