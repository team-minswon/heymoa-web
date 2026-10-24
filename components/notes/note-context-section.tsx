"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { HelpTip } from "@/components/ui/help-tip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { errorCodeOf } from "@/lib/api/error-message";
import {
  getGetNoteQueryKey,
  useUpdateNoteContext,
} from "@/lib/api/generated/notes/notes";
import type { MeetingPhase } from "@/lib/notes/meeting-state";
import { invalidateNoteLifecycle } from "@/lib/notes/invalidate";
import { cn } from "@/lib/utils";

export const TOPIC_MAX = 200;
export const BACKGROUND_MAX = 1000;
/** 입력을 멈추고 이만큼 지나면 저장한다. 포커스가 빠지면 기다리지 않는다. */
const SAVE_DELAY_MS = 800;

const HELP =
  "회의가 무엇에 관한 것인지 알려 주면 받아 적을 때 참고해요. 프로젝트 이름·회의 제목·참석자 이름은 적지 않아도 자동으로 들어가요.";

/**
 * 정보 탭의 타입 위계. 「회의 맥락」·「회의 정보」 두 구역이 **같은 머리글**을 쓰고, 그 아래 라벨은 한 단 작고 흐리게,
 * 값은 라벨보다 크고 진하게 둔다. 예전에는 머리글 13 · 라벨 12 · 값 12~14 가 섞여 무엇이 무엇의 제목인지 안 보였다.
 */
export const INFO_SECTION_TITLE =
  "text-base font-semibold text-[var(--el-ink)]";
export const INFO_LABEL =
  "text-[13px] font-medium tracking-[0.01em] text-[var(--el-muted)]";
/** 구역 사이를 가르는 얇은 선과 여백. 두 구역이 같은 층이라는 것을 선이 말한다. */
export const INFO_SECTION =
  "flex flex-col border-t border-[var(--el-hairline)] pt-6";

type Context = { topic: string; background: string };
/** 서버와 같은 정규화 — 앞뒤 공백을 떼고 빈 값은 지운다(null). */
const normalize = (value: Context) => ({
  topic: value.topic.trim() || null,
  background: value.background.trim() || null,
});
const sameContext = (a: Context, b: Context) => {
  const x = normalize(a);
  const y = normalize(b);
  return x.topic === y.topic && x.background === y.background;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function FieldLabel({
  htmlFor,
  label,
  length,
  max,
}: {
  htmlFor?: string;
  label: string;
  length?: number;
  max?: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Label htmlFor={htmlFor} className={INFO_LABEL}>
        {label}
      </Label>
      {/* 글자 수는 라벨 줄 오른쪽에 둔다 — 줄을 새로 만들지 않아 나타나도 아래가 안 밀린다. 비어 있으면 「0 / 200」을
          보이지 않는다(읽을 것이 없는 같은 무게의 숫자). */}
      {max !== undefined && length ? (
        <span
          className={cn(
            "text-xs tabular-nums",
            length >= max
              ? "text-[var(--el-ink)]"
              : "text-[var(--el-muted-soft)]"
          )}
        >
          {length.toLocaleString("ko-KR")} / {max.toLocaleString("ko-KR")}
        </span>
      ) : null}
    </div>
  );
}

function SectionHeading({ status }: { status?: React.ReactNode }) {
  return (
    <div className="mb-4 flex min-h-6 items-center justify-between gap-3">
      <h2
        id="note-context-title"
        className={cn("flex items-center gap-1", INFO_SECTION_TITLE)}
      >
        회의 맥락
        <HelpTip label="회의 맥락">{HELP}</HelpTip>
      </h2>
      {status}
    </div>
  );
}

/**
 * 정보 탭의 「회의 맥락」 (APP-1190). 참석자 아래, 회의 정보 위.
 *
 * **저장은 자동이다.** 입력을 멈추고 잠시 뒤, 또는 포커스가 빠질 때 보낸다. 제목은 「변경 저장」 버튼인데 여기를 버튼으로
 * 두지 않은 이유: 회의 중에 적는 칸이라 버튼을 누르는 것을 잊고 녹음을 이어 가면 그 연결에 맥락이 안 실린다. 제목 폼과는
 * 구역(머리글)으로 나뉘고, 저장 상태는 머리글 오른쪽에 그 구역 것으로 보인다.
 *
 * **화면의 값은 내 입력이 원본이다.** 저장 응답은 노트 캐시에만 쓰고 입력란에는 쓰지 않는다. 진행 중 폴링이 노트를 다시
 * 받아도, 내가 한 글자라도 고쳤으면(저장이 끝나 서버와 같아지기 전까지) 입력란을 서버 값으로 되돌리지 않는다. 저장은
 * 한 번에 하나만 보내고, 그 사이 더 쓴 것은 끝난 뒤 **마지막 값 하나만** 보낸다.
 */
export function NoteContextSection({
  noteId,
  phase,
  topic,
  background,
}: {
  noteId: string;
  phase: MeetingPhase;
  topic: string | null;
  background: string | null;
}) {
  const server: Context = { topic: topic ?? "", background: background ?? "" };
  // 저장하려던 사이 회의가 끝났다(409). 읽기 전용으로 바뀌어도 쓴 글을 버리지 않고 복사할 수 있게 보인다.
  const [unsaved, setUnsaved] = useState<Context | null>(null);

  if (phase === "ended") {
    return (
      <section aria-labelledby="note-context-title" className={INFO_SECTION}>
        <SectionHeading />
        {server.topic || server.background ? (
          <dl className="flex flex-col gap-5">
            <ReadOnlyValue label="주제" value={server.topic} emphasis />
            <ReadOnlyValue label="배경" value={server.background} />
          </dl>
        ) : (
          <p className="text-sm text-[var(--el-muted)]">
            적어 둔 맥락이 없어요.
          </p>
        )}
        {unsaved && !sameContext(unsaved, server) ? (
          <div className="mt-4 flex flex-col gap-2 rounded-control border border-dashed border-[var(--el-hairline-strong)] p-3">
            <p className="text-xs text-[var(--el-body)]">
              회의가 끝나 저장하지 못한 내용이에요. 필요하면 복사해 두세요.
            </p>
            <dl className="flex flex-col gap-5 select-text">
              <ReadOnlyValue label="주제" value={unsaved.topic} emphasis />
              <ReadOnlyValue label="배경" value={unsaved.background} />
            </dl>
          </div>
        ) : null}
      </section>
    );
  }
  return (
    <EditableContext
      key={noteId}
      noteId={noteId}
      recording={phase === "active"}
      server={server}
      onEnded={setUnsaved}
    />
  );
}

/** 읽기 전용 값. 주제는 한 줄 요지라 본문보다 한 단 굵게, 배경은 빈 줄을 문단으로 나눠 읽힌다. */
function ReadOnlyValue({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className={INFO_LABEL}>{label}</dt>
      <dd
        className={cn(
          "flex flex-col gap-3 break-words text-[15px] leading-[1.7]",
          !value
            ? "text-[var(--el-muted)]"
            : cn("text-[var(--el-ink)]", emphasis && "font-medium")
        )}
      >
        {value
          ? value.split(/\n\s*\n/).map((paragraph, index) => (
              <p key={index} className="whitespace-pre-wrap">
                {paragraph}
              </p>
            ))
          : "적지 않았어요"}
      </dd>
    </div>
  );
}

function EditableContext({
  noteId,
  recording,
  server,
  onEnded,
}: {
  noteId: string;
  recording: boolean;
  server: Context;
  onEnded: (draft: Context) => void;
}) {
  const queryClient = useQueryClient();
  const update = useUpdateNoteContext();
  const [draft, setDraft] = useState<Context>(server);
  const [state, setState] = useState<SaveState>("idle");
  /** 내가 고친 것이 아직 서버와 같아지지 않았다. 이 동안은 서버 값으로 입력란을 되돌리지 않는다. */
  const [touched, setTouched] = useState(false);

  // 서버 값이 바뀌었다(다른 사람이 고쳤거나 폴링). 내가 손대지 않았을 때만 받아들인다.
  const [seen, setSeen] = useState<Context>(server);
  if (seen.topic !== server.topic || seen.background !== server.background) {
    setSeen(server);
    if (!touched) setDraft(server);
  }

  const latest = useRef(draft);
  /** 서버가 마지막으로 확인한 값. 이것과 같으면 보낼 것이 없다. */
  const sent = useRef<Context>(server);
  useEffect(() => {
    sent.current = { topic: seen.topic, background: seen.background };
  }, [seen.topic, seen.background]);
  const inFlight = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  // 기다리던 저장이 있는데 탭을 옮기거나 노트를 닫았다 — 버리지 않고 바로 보낸다.
  const flush = useRef<() => void>(() => {});
  useEffect(
    () => () => {
      if (timer.current) flush.current();
    },
    []
  );

  const save = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    const value = latest.current;
    if (sameContext(value, sent.current)) {
      setTouched(false);
      setState((current) => (current === "error" ? "saved" : current));
      return;
    }
    inFlight.current = true;
    setState("saving");
    try {
      const response = await update.mutateAsync({
        noteId,
        data: normalize(value),
      });
      if (response.status === 200 && response.data.success) {
        sent.current = value;
        // 떠 있던 노트 조회(폴링)가 저장 전 값을 늦게 써서 캐시를 되돌리지 않게 끊고 응답을 쓴다. 입력란에는 쓰지 않는다.
        await queryClient.cancelQueries({
          queryKey: getGetNoteQueryKey(noteId),
        });
        queryClient.setQueryData(getGetNoteQueryKey(noteId), response);
        // 보낸 뒤 더 쓰지 않았으면 서버와 같아졌다 — 이제 남의 변경을 다시 따라간다.
        if (sameContext(latest.current, value)) setTouched(false);
        setState("saved");
      }
    } catch (error) {
      setState("error");
      // 그 사이 회의가 끝났다 — 노트를 다시 받아 읽기 전용으로 바꾼다. 쓴 글은 위로 넘겨 읽기 전용 화면에 남기고,
      // 이유는 토스트(전역)가 말한다.
      if (errorCodeOf(error) === "MEETING_ALREADY_ENDED") {
        onEnded(latest.current);
        void invalidateNoteLifecycle(queryClient, noteId);
      }
      again.current = false;
    } finally {
      inFlight.current = false;
    }
    if (again.current) {
      again.current = false;
      void save();
    }
  };

  useEffect(() => {
    flush.current = () => void save();
  });

  const change = (next: Context) => {
    setDraft(next);
    setTouched(true);
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
  };

  const status =
    state === "saving" ? (
      <span className="text-xs text-[var(--el-muted)]">저장하는 중…</span>
    ) : state === "saved" ? (
      <span className="text-xs text-[var(--el-muted)]">저장했어요</span>
    ) : state === "error" ? (
      <span className="flex items-center gap-1.5 text-xs text-[var(--el-error-strong)]">
        저장하지 못했어요
        <button
          type="button"
          onClick={() => void save()}
          className="cursor-pointer font-medium underline underline-offset-2 hover:text-[var(--el-ink)]"
        >
          다시 시도
        </button>
      </span>
    ) : null;

  return (
    <section
      aria-labelledby="note-context-title"
      className={INFO_SECTION}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null))
          return;
        void save();
      }}
    >
      <SectionHeading
        status={
          <p role="status" aria-live="polite">
            {status}
          </p>
        }
      />
      {/* 꼭 알아야 하는 상태라 ? 안에 넣지 않고 본문에 둔다. 녹음 중일 때만이다. */}
      {recording ? (
        <p className="mb-3 flex items-center gap-2 text-xs text-[var(--el-body)]">
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-[var(--el-error)]"
          />
          녹음 중이에요. 고친 내용은 녹음을 다시 이어 갈 때부터 반영돼요.
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel
            htmlFor="note-context-topic"
            label="주제"
            length={draft.topic.length}
            max={TOPIC_MAX}
          />
          <Input
            id="note-context-topic"
            value={draft.topic}
            maxLength={TOPIC_MAX}
            autoComplete="off"
            placeholder="예: 주간 제품 회의 · 결제 오류 대응과 다음 주 출시 일정"
            onChange={(event) =>
              change({ ...draft, topic: event.target.value })
            }
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel
            htmlFor="note-context-background"
            label="배경"
            length={draft.background.length}
            max={BACKGROUND_MAX}
          />
          <Textarea
            id="note-context-background"
            value={draft.background}
            maxLength={BACKGROUND_MAX}
            placeholder="예: 지난주 결제 승인 실패가 늘어 원인을 찾는 중이에요. 오늘은 PG사 로그 결과와 임시 조치를 정해요."
            onChange={(event) =>
              change({ ...draft, background: event.target.value })
            }
            className="min-h-[88px] max-h-60 resize-none"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * 정보 탭 스켈레톤의 같은 자리. 머리글은 그대로 그리고 값 한 줄만 막대로 둔다.
 *
 * **종료된 회의의 모양에 맞춘다.** 스켈레톤이 뜰 때는 노트를 아직 못 받아 회의 상태를 모른다. 스켈레톤이 실제로 보이는
 * 것은 목록에서 지난 회의를 처음 열 때가 대부분이고(진행 중 회의는 녹음 화면이 노트를 이미 받아 두어 바로 그린다),
 * 그 회의는 대개 맥락이 비어 한 줄이다(`e2e/skeleton-geometry`).
 */
export function NoteContextSkeleton() {
  return (
    <section className={INFO_SECTION}>
      <div className="mb-4 flex min-h-6 items-center">
        <h2 className={INFO_SECTION_TITLE}>회의 맥락</h2>
      </div>
      <div className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-40 rounded-chip" />
      </div>
    </section>
  );
}
