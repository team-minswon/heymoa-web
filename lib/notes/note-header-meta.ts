import type { NoteResponseData } from "@/lib/api/generated/models";
import { formatAppDate } from "@/lib/format/date";
import { getRecordedDurationMs } from "@/lib/notes/meeting-state";

/**
 * 노트 헤더 메타 두 줄. design.pen `u3yYCX`/`XtEMZ`의 Meta Row —
 * 위는 `참석자 N명 · 날짜`, 아래는 회의 상태가 지금 무엇을 뜻하는지다.
 *
 * **아래 줄이 상태별로 갈리는 이유는 같은 자리가 다른 질문에 답하기 때문이다.** 시작 전에는
 * 「언제 시작하나」, 기록 중에는 「누가 보나(그리고 누가 기록 중인가)」, 끝난 뒤에는
 * 「얼마나 기록됐나」다. 한 줄로 합치면 어느 상태에서도 절반이 군더더기가 된다.
 *
 * 정본은 아래 줄에 `워크스페이스 멤버 4명 공개`처럼 수를 적어 두었지만 **그 수는 계약에
 * 없다** — 노트가 아는 것은 참석자(`participants`)뿐이고 위 줄이 이미 그 수를 말한다.
 * 같은 수를 두 번 적는 대신 수를 뺐다.
 */
export function buildNoteHeaderMeta(
  note: NoteResponseData,
  { isStarter }: { isStarter: boolean }
): {
  /** 참석자 수. 계약이 빈 배열을 줄 수 있어 없으면 `null`이다 — 「참석자 0명」은 정보가 아니다. */
  participantLabel: string | null;
  /** `<time datetime>`에 그대로 넣는다. 절대 시각은 기계도 읽어야 한다. */
  whenIso: string;
  whenLabel: string;
  secondary: string;
} {
  const participantCount = note.participants?.length ?? 0;
  const whenIso = note.meetingStartedAt ?? note.createdAt;
  const head = {
    participantLabel:
      participantCount > 0 ? `참석자 ${participantCount}명` : null,
    whenIso,
    whenLabel: formatAppDate(whenIso, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  };

  if (note.meetingStatus === "NOT_STARTED") {
    return { ...head, secondary: "아직 시작하지 않았습니다" };
  }

  if (note.meetingStatus === "IN_PROGRESS") {
    const starter = note.meetingStartedBy;
    return {
      ...head,
      secondary: [
        // 참관 중일 때만 누가 기록 중인지 적는다. 시작자에게는 자기 이름이라 군더더기다.
        !isStarter && starter ? `${starter.name}님이 기록 중` : null,
        "워크스페이스 멤버에게 공개",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  // 중지·종료는 누적 기록 시간이다. **`now`를 안 받는다** — 여기까지 오는 상태에서는
  // 진행 중 구간이 0이라(`getRecordedDurationMs`) 시계가 필요 없고, 렌더 중에 `Date.now()`를
  // 읽으면 서버 HTML과 첫 클라이언트 렌더가 갈려 하이드레이션이 어긋난다.
  const minutes = Math.floor(getRecordedDurationMs(note, 0) / 60_000);
  return { ...head, secondary: `기록 ${minutes}분 (종료 세션 누적)` };
}
