"use client";

import { Fragment, useState } from "react";
import { Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/ui/toast";

import { NoteParticipantsField } from "@/components/notes/note-participants-field";
import { ParticipantAvatar } from "@/components/notes/note-participants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGetNoteQueryKey,
  getGetNotesQueryKey,
  useGetNoteSuspense,
  useUpdateNote,
} from "@/lib/api/generated/notes/notes";
import { formatAppDate } from "@/lib/format/date";
import { getRecordedDurationMs } from "@/lib/notes/meeting-state";
import { useAlignedNow } from "@/lib/notes/use-aligned-now";

function formatRecordedClock(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(
    totalSeconds % 60
  ).padStart(2, "0")}`;
}

/** 라벨 + 컨트롤 한 칸. design.pen `OmVNh`: vertical · gap 6 · 라벨 12/600. */
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-[var(--el-ink)]">
        {label}
      </Label>
      {children}
    </div>
  );
}

/**
 * 「회의 정보」 표의 한 줄. design.pen `M0Bfl`: 키 열 **124 고정** · 값 12px.
 *
 * 키 열을 고정하는 이유는 값이 세로로 훑히기 때문이다 — 키 길이에 따라 값이 들쭉날쭉하면
 * 「무엇이 무엇인지」를 한 줄씩 다시 읽어야 한다.
 */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[30px] items-center gap-3">
      <dt className="w-[124px] shrink-0 text-xs text-[var(--el-body)]">
        {label}
      </dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--el-ink)]">
        {children}
      </dd>
    </div>
  );
}

/**
 * 정보 탭의 본문 상자. design.pen `VaEPF`: vertical · gap 24 · 좌우는 뷰가 정하는 거터다.
 *
 * **스켈레톤과 실제가 같은 것을 쓴다.** 예전에는 두 곳에 같은 클래스 문자열을 손으로
 * 적어 두었고, 한쪽만 고쳐져 로딩이 끝날 때 본문이 밀렸다.
 */
function Body({
  children,
  ...rest
}: { children: React.ReactNode } & React.ComponentProps<"div">) {
  return (
    <div
      {...rest}
      className="mx-auto flex w-full max-w-[calc(820px+2*var(--note-gutter))] flex-col gap-6 px-[var(--note-gutter)] pb-36 pt-6"
    >
      {children}
    </div>
  );
}

/** 회의의 사실과 문서의 이력을 가르는 선 (design.pen `i3zDhK`). */
function FactDivider() {
  return (
    <div aria-hidden className="my-2.5 h-px w-full bg-[var(--el-hairline)]" />
  );
}

export function NoteDetails({
  noteId,
  workspaceId,
}: {
  noteId: string;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const noteResponse = useGetNoteSuspense(noteId).data;
  const updateNote = useUpdateNote({
    mutation: { meta: { suppressErrorToast: true } },
  });
  const [feedback, setFeedback] = useState<"saved" | null>(null);
  const loaded =
    noteResponse.status === 200 && noteResponse.data.success
      ? noteResponse.data.data
      : undefined;
  // **throw보다 먼저 부른다.** 아래 경계로 던지는 렌더와 정상 렌더가 훅 개수까지 달라지면
  // 안 된다. 진행 중일 때만 돌고, 세션 시작 초에 맞춰 눈금이 튀지 않게 원점을 넘긴다.
  const now = useAlignedNow(
    1_000,
    loaded?.meetingStatus === "IN_PROGRESS",
    loaded?.activeSessionStartedAt
      ? [Date.parse(loaded.activeSessionStartedAt)]
      : []
  );
  // **프로젝트를 여기서 조회하지 않는다.** 노트 헤더의 pill이 이미 그 이름을 말하고, 계약에
  // 노트의 프로젝트를 바꾸는 길도 없다(`NoteRequest`는 `title`만 받는다).

  // suspense가 네트워크 실패는 throw하지만, 계약 위반 봉투(200 아님·success=false)도 경계로 보낸다.
  if (!loaded) {
    throw new Error("노트를 불러오지 못했습니다.");
  }
  const note = loaded;

  // 노트 단건과 목록을 함께 무효화한다 — 목록은 projectId별로 조회하므로(workspace-page)
  // 단건만 무효화하면 제목 변경이 목록에 반영되지 않는다.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetNoteQueryKey(noteId) }),
      queryClient.invalidateQueries({
        queryKey: getGetNotesQueryKey(note.projectId),
      }),
    ]);

  const timestamp = (iso: string) =>
    formatAppDate(iso, { dateStyle: "medium", timeStyle: "short" });

  return (
    // **카드가 없다.** 예전에는 제목·참여자·사실이 각자 `rounded-block` 상자에 들어 있었는데,
    // 카드 넷이 쌓이면 무엇이 편집이고 무엇이 읽기인지 테두리로는 구분되지 않았다.
    // 지금은 편집만 컨트롤 테두리를 갖고, 읽기는 키/값 표로 눕는다.
    <Body>
      <form
        // 저장이 끝나면 `updatedAt`이 바뀌어 이 폼이 재마운트되고 입력이 서버 값으로 돌아온다.
        // 낙관적 표시 없이 서버가 확정한 것만 보이게 하는 장치다.
        key={`${note.noteId}-${note.updatedAt}`}
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setFeedback(null);
          const form = new FormData(event.currentTarget);
          const title = String(form.get("title") ?? "").trim();
          try {
            await updateNote.mutateAsync({
              noteId,
              data: {
                title: title || "제목 없는 노트",
              },
            });
            await refresh();
            setFeedback("saved");
          } catch {
            toast.error("저장하지 못했습니다. 입력한 내용은 유지됩니다.", {
              id: `note-save-${noteId}`,
            });
          }
        }}
      >
        <Field label="제목" htmlFor="note-title">
          <Input
            id="note-title"
            name="title"
            defaultValue={note.title}
            maxLength={200}
            className="h-9"
          />
        </Field>

        {/* **회의 상태로 가르지 않는다.** 계약이 "회의 상태와 무관하게 언제나 호출할 수 있다"고
            못박은 자리다(`PUT /v1/notes/{noteId}/participants`) — 늦게 합류한 사람을 기록 중인
            회의나 끝난 회의에 뒤늦게 넣는 일은 실제로 생긴다. 정본은 시작 전 화면에서만
            편집하게 그려 두었지만, 그러면 그 일을 할 방법이 사라진다. */}
        <Field label="참석자">
          <NoteParticipantsField
            noteId={noteId}
            projectId={note.projectId}
            workspaceId={workspaceId}
            participants={note.participants}
          />
        </Field>

        {/* 정본은 「변경 사항은 자동 저장됩니다」지만 저장은 명시적으로 둔다. 저장이 끝나면
            `updatedAt`이 바뀌어 이 폼이 재마운트되므로, 자동 저장은 **타이핑 중에 커서를
            날린다.** 편집 대상이 제목 하나뿐이라 버튼 하나로 잃는 것도 없다. */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            loading={updateNote.isPending}
            className="rounded-control px-3.5"
          >
            <Check /> 변경 저장
          </Button>
          {feedback === "saved" ? (
            <span role="status" className="text-xs text-[var(--el-muted)]">
              저장됨
            </span>
          ) : null}
        </div>
      </form>

      {/**
       * **표는 헤더가 말하지 않은 것만 담는다.**
       *
       * 한때 회의 상태·프로젝트·시작 시각·참석자를 여기 다시 적었는데, 넷 다 바로 위
       * 노트 헤더에 **글자까지 같은 모양으로** 이미 있다(상태 칩, 프로젝트 pill, 메타 두 줄).
       * 참석자는 더 심해서, 헤더와 이 탭의 편집 필드와 표에 세 번 나왔다.
       *
       * 그래서 남긴 기준은 「한 줄 요약에 안 들어가는 사실」이다 —
       * - 진행자: 헤더는 참관자에게만 이름을 말한다
       * - 누적 기록 시간: 헤더는 분 단위 요약이고 기록 중에는 아예 안 적는다
       * - 공유 범위: 헤더 메타 둘째 줄은 종료되면 누적 시간으로 바뀌어 이 값을 놓는다
       * - 생성·최종 수정: 회의의 사실이 아니라 문서의 이력이라 헤더에 없다
       */}
      <section aria-labelledby="note-facts-title" className="flex flex-col">
        <h2
          id="note-facts-title"
          className="mb-2.5 text-[13px] font-semibold text-[var(--el-ink)]"
        >
          회의 정보
        </h2>
        <dl className="flex flex-col">
          {note.meetingStartedBy ? (
            <Fact label="진행자">
              <ParticipantAvatar
                participant={note.meetingStartedBy}
                size="sm"
                isStarter
              />
              <span className="ml-1">
                {note.meetingStartedBy.name}
                <span className="font-normal text-[var(--el-muted)]">
                  {" · 기록 제어 권한"}
                </span>
              </span>
            </Fact>
          ) : null}
          {/* 초 단위로 바뀌는 값은 여기 하나뿐이다 — 노트 헤더는 같은 값을 분 단위로 요약하고
              (「기록 42분」), 진행 중 라이브 타이머는 레코더 독이 갖는다. */}
          <Fact label="누적 기록 시간">
            <span role="timer" aria-label="누적 기록 시간" className="tabular-nums">
              {formatRecordedClock(getRecordedDurationMs(note, now ?? 0))}
            </span>
            <span className="font-normal text-[var(--el-muted)]">
              · 종료된 구간만 합산
            </span>
          </Fact>
          {/* 정본은 「워크스페이스 멤버 4명 공개」지만 그 수는 노트 계약에 없다 — 참석자 수와
              헷갈리기도 해서 수를 뺐다(노트 헤더 메타와 같은 판단). */}
          <Fact label="공유 범위">워크스페이스 멤버에게 공개</Fact>

          {/* 위는 회의의 사실, 아래는 문서의 이력이다 — 선 하나로 가른다. */}
          <FactDivider />
          <Fact label="생성">
            <time dateTime={note.createdAt}>{timestamp(note.createdAt)}</time>
          </Fact>
          <Fact label="최종 수정">
            <time dateTime={note.updatedAt}>{timestamp(note.updatedAt)}</time>
          </Fact>
        </dl>
      </section>
    </Body>
  );
}

/**
 * 노트 정보 로딩 스켈레톤. DataBoundary fallback으로 부모(note-panel)가 쓴다.
 *
 * **실제 화면과 같은 wrapper(`Body`·`Field`·`Fact`)로 짓는다.** 손으로 막대 몇 개를 쌓았을
 * 때 296이었고 실제는 568이었다 — 라벨·저장 버튼·「회의 정보」 머리글이 스켈레톤에 없고
 * 표 다섯 줄이 `h-40` 한 덩어리였다. 도착하는 순간 아래 절반이 밀려 내려왔다.
 *
 * **라벨과 머리글은 가리지 않는다.** 그것들은 도착을 기다리는 값이 아니라 화면의 뼈대다.
 * 그대로 그리면 기하가 자동으로 맞고, 무엇을 불러오는 중인지도 읽힌다.
 */
export function NoteDetailsSkeleton() {
  return (
    <Body aria-label="노트 정보 불러오는 중">
      <div className="flex flex-col gap-4">
        <Field label="제목">
          <Skeleton className="h-9 w-full rounded-control" />
        </Field>
        {/* 실측: 참석자 컨트롤 줄은 32(아바타 스택 + `참여자 선택` 버튼), 저장 버튼은 32×105. */}
        <Field label="참석자">
          <Skeleton className="h-8 w-56 rounded-control" />
        </Field>
        <Skeleton className="h-8 w-[105px] rounded-control" />
      </div>
      <section className="flex flex-col">
        <h2 className="mb-2.5 text-[13px] font-semibold text-[var(--el-ink)]">
          회의 정보
        </h2>
        <dl className="flex flex-col">
          {FACT_ROWS.map(({ label, width }) => (
            <Fragment key={label}>
              {/* 실제와 같은 자리에 선이 있어야 높이가 맞는다 — 회의의 사실과 문서의 이력. */}
              {label === "생성" ? <FactDivider /> : null}
              <Fact label={label}>
                {/* 값 폭은 실제와 비슷하게 — 전부 같으면 표가 아니라 블록으로 보인다. */}
                <Skeleton
                  className="h-3.5 rounded-chip"
                  style={{ width }}
                />
              </Fact>
            </Fragment>
          ))}
        </dl>
      </section>
    </Body>
  );
}

/** 사실 표의 키 열은 데이터가 아니다 — 실제 화면과 같은 순서·같은 라벨을 그린다. */
const FACT_ROWS = [
  { label: "진행자", width: 180 },
  { label: "누적 기록 시간", width: 148 },
  { label: "공유 범위", width: 132 },
  { label: "생성", width: 156 },
  { label: "최종 수정", width: 156 },
];
