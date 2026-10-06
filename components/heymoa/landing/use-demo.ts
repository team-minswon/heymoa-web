import { useCallback, useEffect, useMemo, useState } from "react";

import type { TimelineTone } from "@/lib/notes/proposals/timeline";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * 제품 화면이 **혼자 한 바퀴 돈다**. 회의가 도는 중에 말이 스크립트로 들어오고, 타임라인에
 * 쌓이고, 에이전트에게 묻고, 중지한 뒤 회의를 끝내면 요약 탭에 검토 문서가 선다 — 랜딩이
 * 문장으로 설명하던 순서를 화면이 그대로 한 번 보여 준다.
 *
 * ## 앞으로만 간다
 *
 * 첫 렌더(= SSR = JS 끈 화면)가 **대본의 시작**이다. 회의 다섯 줄이 이미 적혀 있고 「기록
 * 중」이며, 타임라인에도 그 다섯 줄에서 나온 항목이 서 있다. 거기서 앞으로만 흐르고, 끝나면
 * 그 자리에 선다.
 *
 * 반대로 「끝난 화면을 먼저 그리고 되감는」 방식도 있었는데 그건 못 쓴다 — 하이드레이션
 * 뒤에 되감으면 다 찬 스크립트가 한 프레임 보였다가 비는 것이 보인다. 앞으로만 가면 그
 * 깜빡임이 아예 없다.
 *
 * ## 손대면 **탭만** 고정한다
 *
 * 방문자가 노트 탭을 누르면 그 탭을 그 자리에 못 박고(`noteOverride`), **대본은 계속 돈다.**
 * 뺏지 말아야 할 것은 탭이지 내용이 아니다 — 누르자마자 화면이 딴 데로 가면 눌러 보라고
 * 해 놓고 뺏는 셈이지만, 거기서 대본까지 끊으면 이번엔 보여 주려던 것이 통째로 사라진다.
 * 스크립트를 고른 사람은 줄이 계속 들어오는 것을 보고, 정보를 고른 사람 옆에서도 에이전트는
 * 계속 답한다. 탭이 있는 기둥은 노트 하나뿐이다 — 앱의 오른쪽 레일은 APP-863 부터 「내
 * 에이전트」 하나라 탭이 없다.
 *
 * **장면이 바뀌는 이동은 고정을 이긴다**(`force`). 대본이 탭을 옮기는 자리는 둘뿐이고 둘 다
 * 새 장면의 시작이다 — 타임라인으로 가는 것(회의 중 정리 장면)과, 회의가 끝나 요약 탭으로
 * 가는 것. 고정이 이것까지 막으면 방문자가 아무거나 한 번 눌렀다는 이유로 **장면 하나가
 * 통째로 사라진다.** 고정이 지키는 것은 「방금 누른 것이 곧바로 되돌려지지 않는다」까지이고,
 * 다음 장면에는 같이 간다.
 *
 * 요약 탭으로 가는 이동은 그 위에 근거가 하나 더 있다 — 회의가 끝나면 **앱이** 그렇게
 * 한다(`meeting-controls.tsx`의 `onMeetingEnded` → `note-panel.tsx`).
 *
 * 모션을 줄인 사람에게는 대본을 아예 안 돌린다. 처음부터 끝 상태다.
 *
 * ## 끝나면 스스로 다시 돈다
 *
 * 한 바퀴가 끝나면 `LOOP_GAP` 뒤에 처음으로 돌아가고, 돌 때 고정과 손수 보낸 질문까지
 * 되돌린다. **손댄 사람에게도 돈다** — 한때 안 돌렸는데, 아무거나 한 번 눌렀다는 이유로
 * 화면이 그 자리에 굳어 다시 볼 방법이 없었다. 다시 보기 버튼은 두지 않는다.
 *
 * 세 가지만 반복을 미룬다. **화면 밖이면 아예 안 돈다**(대본 자체가 쉰다), **손수 보낸 답이
 * 흐르는 동안에는 예약하지 않는다** — 남은 대기가 답보다 짧으면 예약해 둔 반복이 답을 중간에
 * 지운다 — 그리고 **일시정지 중이면 안 돈다.**
 *
 * ## 일시정지 버튼 하나만 둔다
 *
 * 화면에 있는 한 스스로 계속 도는 움직임이라, 멈출 수단이 없으면 WCAG 2.2.2(Level A)에
 * 걸린다 — 모션 줄이기 설정은 이 기준의 수단으로 안 친다. 정지(처음으로) · 다시 보기는 여전히
 * 안 둔다. 멈춘 것은 **방문자가 고른 것이라 반복이 되돌리지 않는다.**
 */

/* ── 이 회의 ────────────────────────────────────────────────────────────── */

export const TITLE = "3차 스프린트 킥오프";
export const PROJECT = "온보딩 개선";
/** 결제 화면 개편을 처음 미룬 회의. 에이전트가 근거로 읽는다. */
const EARLIER = "2차 스프린트 킥오프";

/**
 * `who`는 사람 이름이지만 **스크립트에는 안 나온다.** 앱에서 회의가 끝나고 붙는 것은 화자
 * 라벨(`화자 A`)이고, 거기에 이름을 다는 것은 사람이 하는 일이다
 * (`speaker-identity.ts`의 `displayName` — 연결 안 됐으면 `화자 A`).
 * 여기서는 라벨을 만드는 근거와, 정보 탭의 참석자로만 쓴다.
 */
export type Line = { at: string; who: string; text: string };

/** 목소리 덩어리 하나에 붙는 라벨. 말한 순서가 아니라 사람 단위로 갈린다. */
export const SPEAKER_LABEL: Record<string, string> = {
  김민서: "A",
  박지훈: "B",
  이서연: "C",
  정우재: "D",
};

/** 참석자 얼굴의 열쇠 — 랜딩 전체가 같은 것을 쓴다(`shell.tsx`). */
export { FACE_KEY } from "@/components/heymoa/landing/shell";

export const TRANSCRIPT: Line[] = [
  {
    at: "00:00",
    who: "김민서",
    text: "이번 스프린트는 온보딩 이탈부터 봅니다. 지난주에 남긴 가설 두 개를 먼저 정리하죠.",
  },
  {
    at: "00:14",
    who: "박지훈",
    text: "지난 회의에서 결제 화면 개편은 다음으로 미뤘습니다. 그 결정 그대로 갑니다.",
  },
  {
    at: "00:31",
    who: "이서연",
    text: "저는 이번에 합류해서 그 맥락을 모릅니다. 왜 미뤘는지 다시 볼 수 있을까요?",
  },
  {
    at: "00:44",
    who: "김민서",
    // **이유는 이 회의에 없다** — 2차 회의록에 있다. 그래서 타임라인이 아니라 에이전트를
    // 가리킨다. 레일의 `SEED`(「결제 화면 개편은 왜 미뤘나요?」)가 이 말의 답이다.
    text: "에이전트한테 물어보면 2차 회의록에서 찾아 줘요.",
  },
  {
    at: "01:02",
    who: "정우재",
    text: "그럼 온보딩 이탈 로그 수집은 제가 맡겠습니다. 이번 주 목요일까지 초안 올릴게요.",
  },
  {
    at: "01:19",
    who: "박지훈",
    text: "좋습니다. 그 작업은 Linear 이슈로 바로 내보내는 게 좋겠어요.",
  },
  {
    at: "01:33",
    who: "이서연",
    text: "그 이슈에 이 회의 결정도 근거로 붙일 수 있나요? 다음에 들어올 사람도 보게요.",
  },
  {
    at: "01:48",
    who: "김민서",
    text: "그건 내보낼 때 같이 보죠. 오늘 남길 건 여기까지입니다.",
  },
];

/** 회의 길이. 마지막 발화가 끝난 때다. */
export const LENGTH = "01:52";

/**
 * 타임라인(`note-timeline.tsx`). **차례가 곧 뜨는 순서다** — 앞의 `BASE_ENTRIES`개는
 * 처음부터 있고 나머지는 대본이 하나씩 올린다.
 *
 * `tone`이 없는 줄은 **안건**이다. 앱처럼 안건이 나오면 그 뒤의 항목은 다음 안건까지 그
 * 아래에 든다(`lib/notes/proposals/timeline.ts` — 소속은 순서로 정한다).
 *
 * 항목은 전부 위 스크립트에서 짚을 수 있는 말에서 나온다(`cites`는 그 줄의 차례). `meta`는
 * 앱이 유형 이름 뒤에 덧붙이는 말만 쓴다 — 「답을 기다리는 중」 · 「00:44에 답함」.
 */
export type Entry = {
  kind: string;
  title: string;
  at: string;
  tone?: TimelineTone;
  meta?: string;
  cites?: number[];
  /**
   * 이 질문의 답이 된 항목 — `TIMELINE`의 차례다. 펼친 카드의 「↗ 답」 줄이 된다.
   * **반대쪽(「↗ 답한 질문」)은 적지 않고 그릴 때 찾는다** — 두 칸에 나눠 적으면 한쪽만
   * 고쳐 서로 다른 항목을 가리키게 된다.
   */
  answer?: number;
};

export const TIMELINE: Entry[] = [
  { kind: "안건", title: "스프린트 우선순위", at: "00:00" },
  {
    kind: "결정",
    tone: "decision",
    title: "온보딩 이탈을 이번 스프린트의 첫 기준선으로 삼는다",
    at: "00:00",
    cites: [0],
  },
  {
    kind: "결정",
    tone: "decision",
    title: "결제 화면 개편은 다음 스프린트로 미룬다",
    at: "00:14",
    cites: [1],
  },
  {
    kind: "질문",
    tone: "answered",
    title: "결제 화면 개편을 미룬 이유는 무엇인가",
    at: "00:31",
    meta: "00:44에 답함",
    cites: [2],
    answer: 4,
  },
  {
    kind: "인사이트",
    tone: "reference",
    title: "미룬 이유는 2차 회의 결정에 남아 있다",
    at: "00:44",
    cites: [3],
  },
  { kind: "안건", title: "온보딩 이탈 로그 수집", at: "01:02" },
  {
    kind: "할 일",
    tone: "task",
    title: "온보딩 이탈 로그 수집 초안을 목요일까지 올린다",
    at: "01:02",
    cites: [4],
  },
  // ↓ 대본이 올린다.
  {
    kind: "할 일",
    tone: "task",
    title: "로그 수집 작업을 Linear 이슈로 내보낸다",
    at: "01:19",
    cites: [5],
  },
  {
    kind: "질문",
    tone: "open",
    title: "Linear 이슈에 이 회의 결정도 근거로 붙일 수 있나",
    at: "01:33",
    meta: "답을 기다리는 중",
    cites: [6],
  },
];

export const BASE_ENTRIES = 7;

/** 타임라인의 「유형으로 골라 보기」. 라벨과 차례는 `TIMELINE_FILTERS` 그대로다. */
export const FILTERS = ["전체", "결정", "할 일", "열린 질문", "참고"] as const;
export type Filter = (typeof FILTERS)[number];

/** 유형 → 골라 보기 칸. 답한 질문은 「참고」로 내려간다(`timeline.ts`의 `FILTER_OF`). */
export const FILTER_OF: Record<TimelineTone, Filter> = {
  decision: "결정",
  task: "할 일",
  open: "열린 질문",
  answered: "참고",
  reference: "참고",
};

/**
 * 요약 탭의 검토 문서(`review-board.tsx`, APP-865). 위에서부터 머리 → 「언제 정해졌나」 →
 * 요약 → 주제 → 결정 → 할 일이고, 이슈 · 질문 · 참고는 요약 보기에 서지 않는다.
 *
 * **담당은 화자 라벨이다.** 이 회의는 화자에 이름을 안 붙인 채 끝나므로, 앱도 담당 칸에
 * 「화자 D」를 쓰고 「이름 없는 화자에게 걸린 할 일」을 센다. 여기 「정우재」를 쓰면 스크립트와
 * 어긋난다.
 */
export const REVIEW = {
  summary:
    "온보딩 이탈을 이번 스프린트의 첫 기준선으로 잡고, 결제 화면 개편은 2차 회의 결정대로 다음 스프린트로 미뤘습니다. 이탈 로그 수집 초안은 목요일까지 올리고, 그 작업을 Linear 이슈로 내보냅니다.",
  topics: [
    {
      at: "00:00",
      title: "스프린트 우선순위",
      gist: "온보딩 이탈을 기준선으로 잡고 결제 화면 개편은 다음 스프린트로 미뤘습니다.",
      counts: [["decision", 2]] as Array<[TimelineTone, number]>,
    },
    {
      at: "01:02",
      title: "온보딩 이탈 로그 수집",
      gist: "초안은 목요일까지 올리고, 작업은 Linear 이슈로 내보냅니다.",
      counts: [
        ["task", 2],
        ["open", 1],
      ] as Array<[TimelineTone, number]>,
    },
  ],
  decisions: [
    {
      text: "온보딩 이탈을 이번 스프린트의 첫 기준선으로 삼습니다.",
      topic: "스프린트 우선순위",
      at: "00:00",
      cites: [0],
    },
    {
      text: "결제 화면 개편은 다음 스프린트로 미룹니다.",
      topic: "스프린트 우선순위",
      at: "00:14",
      cites: [1],
    },
  ],
  tasks: [
    {
      text: "온보딩 이탈 로그 수집 초안 올리기",
      who: "D",
      due: "9월 3일 (목)",
      at: "01:02",
    },
    {
      text: "로그 수집 작업을 Linear 이슈로 내보내기",
      who: "B",
      due: null,
      at: "01:19",
    },
  ],
};

/** 검토 문서가 서는 묶음 수 — 머리와 요약, 주제, 결정, 할 일과 검토 막대. */
export const REVIEW_PARTS = 4;

export const NOTE_TABS = ["정보", "스크립트", "타임라인", "요약"] as const;
export type NoteTab = (typeof NOTE_TABS)[number];

/** 회의 상태. 앱의 `MEETING_STATUS_LABEL` 그대로다(「시작 전」은 이 대본에 안 나온다). */
export type Status = "기록 중" | "중지됨" | "종료됨";

/**
 * 「내 에이전트」의 왕복.
 *
 * **답은 이 회의에 실제로 있는 말만 쓴다** — 위의 `TRANSCRIPT` · `TIMELINE` · `REVIEW`와,
 * 결제 화면 개편을 처음 미룬 앞 회의에서 짚을 수 있는 것뿐이다. 화면 어디에도 없는 사실을
 * 답하면, 「사실 대조판」이라고 말하는 페이지가 제 말을 먼저 어긴다.
 *
 * **대본 어디서 물어도 참인 답만 둔다.** 방문자는 아무 때나 누르므로, 아직 안 나온 말에 기댄
 * 답은 그 순간의 화면과 어긋난다 — 그래서 셋 다 처음부터 적혀 있는 다섯 줄과 앞 회의만 쓴다.
 *
 * `refs`는 「참고한 회의록」이다 — 회의 제목이다. `SEED`는 처음부터 떠 있는 왕복이라 레일이
 * 빈 화면으로 시작하지 않는다.
 */
export type Ask = { q: string; a: string; refs: string[] };

/**
 * 대화에 선 왕복 하나. **`key`는 자리와 무관한 이름이다**(`seed` · `script-N` · `visitor-N`) —
 * 차례로 지으면 앞에 하나가 끼어들 때마다 뒤의 왕복이 다시 마운트되어 등장 애니메이션이 다시
 * 돌고 펼쳐 둔 근거가 접힌다. `mine`은 방문자가 직접 보낸 것이다.
 */
export type Turn = Ask & { key: string; mine: boolean };

export const SEED: Ask = {
  q: "결제 화면 개편은 왜 미뤘나요?",
  a: "온보딩 이탈 지표를 먼저 보기로 해서 다음 스프린트로 미뤘습니다. 2차 회의에서 정한 결정이고, 이번 회의에서 그대로 가기로 했습니다.",
  refs: [EARLIER, TITLE],
};

export const ASKS: Ask[] = [
  {
    q: "온보딩 이탈을 왜 먼저 보나요?",
    a: "이번 스프린트의 첫 기준선으로 삼기로 해서입니다. 지난주에 남긴 가설 두 개를 먼저 정리하자는 말로 회의가 시작됐습니다.",
    refs: [TITLE],
  },
  {
    q: "로그 수집은 누가 맡았나요?",
    a: "01:02에 이번 주 목요일까지 초안을 올리겠다며 맡은 사람이 있습니다. 화자 이름이 아직 붙지 않아 누구인지는 적혀 있지 않습니다.",
    refs: [TITLE],
  },
  {
    q: "제가 없던 사이에 뭐가 정해졌나요?",
    a: "결정 둘입니다. 온보딩 이탈을 이번 스프린트의 첫 기준선으로 삼고, 결제 화면 개편은 지난 결정대로 다음 스프린트로 미뤘습니다.",
    refs: [TITLE],
  },
];

/* ── 대본 ───────────────────────────────────────────────────────────────── */

/** 「생각하는 중」을 뜻하는 진행값. 0 이상은 드러난 글자 수라 음수 하나를 따로 쓴다. */
export const THINKING = -1;

/** 답이 흐르기 전에 머무는 시간. 앱에서 첫 델타가 오기까지와 비슷한 길이다. */
const THINK_MS = 620;

/**
 * 한 바퀴가 끝나고 처음으로 돌아가기까지 쉬는 시간. 끝 화면이 검토 문서라 한 박자보다 조금
 * 길게 — 마지막 묶음(할 일 · 검토 막대)이 서자마자 지워지면 「검토 완료」를 읽을 틈이 없다.
 */
const LOOP_GAP = 2400;

/** 처음부터 적혀 있는 스크립트 줄. 대본은 그 뒤부터 이어 붙인다. */
export const BASE_LINES = 5;

type Beat = { ms?: number; force?: true } & (
  | { t: "say"; i: number }
  | { t: "event" }
  | { t: "note"; v: NoteTab }
  | { t: "ask"; i: number }
  /** 독의 ■가 눌리는 순간. 눌리는 것과 멈추는 것을 다른 대목으로 나눈다. */
  | { t: "stop" }
  | { t: "pause" }
  /** 「회의 종료」가 눌리는 순간. */
  | { t: "press" }
  | { t: "end" }
  | { t: "review" }
);

/**
 * 회의 한 대목. **스크립트 → 타임라인 → 에이전트 → 중지 → 종료 → 요약** 순서로, 랜딩이
 * 아래에서 글로 설명하는 차례와 같다.
 *
 * 타임라인 항목은 그 말이 **끝난 뒤에** 붙는다 — 앱은 끝난 발화만 정리한다(「말이 끝날
 * 때마다 정리됩니다」). 그다음 말이 흐르는 동안은 타임라인 바닥의 받아 적는 줄에 선다.
 */
const BEATS: Beat[] = [
  { t: "say", i: 5 },
  // `force` — 회의 중 정리 장면의 시작이다. 탭을 만져 둔 방문자도 여기서는 같이 간다.
  { t: "note", v: "타임라인", force: true },
  { t: "event" },
  { t: "say", i: 6 },
  { t: "event" },
  { t: "say", i: 7 },
  // 레일은 늘 보이므로 옮길 탭이 없다 — 질의는 그 자리에서 바로 흐른다.
  { t: "ask", i: 2 },
  // **기록 중에는 회의를 끝낼 수 없다**(APP-695). 독에서 먼저 멈추고, 「중지됨」이 된 뒤에야
  // 「회의 종료」가 살아난다. 누르는 것과 바뀌는 것을 나눈다 — 한 대목으로 두면 칩만 바뀌고
  // 정작 「누가 눌렀다」는 순간이 화면에 없다.
  { t: "stop" },
  { t: "pause" },
  { t: "press" },
  { t: "end" },
  // 종료 직후의 요약 탭은 분석 대기(「회의를 분석하는 중입니다」)다. 그 화면이 지나가도록
  // 길게 쉰다. `force` — 회의가 끝나면 앱이 요약 탭으로 넘긴다.
  { t: "note", v: "요약", ms: 1700, force: true },
  ...Array.from({ length: REVIEW_PARTS }, (): Beat => ({ t: "review" })),
];

export const LAST = BEATS.length;

/** 한 글자가 스크립트에 찍히는 간격과, 줄이 확정된 뒤 다음 말까지 쉬는 시간. */
const SAY_MS = 26;
const HOLD: Record<Beat["t"], number> = {
  say: 560,
  event: 700,
  note: 780,
  ask: 1500,
  // **누르는 대목만 느리다.** 회의를 멈추고 끝내는 장면이라 다른 대목과 같은 속도로 지나가면
  // 「버튼이 잠깐 반짝했다」로만 남는다. 손이 닿고 → 눌러 들어가고 → 머물고 → 떼는 네
  // 동작이 다 보일 만큼 준다(CSS `tv-press`가 같은 1.4초를 쓴다 — `landing/motion.tsx`).
  stop: 1400,
  // 칩이 「중지됨」으로, 회의 종료가 살아나는 것을 보고 나서 누른다.
  pause: 900,
  press: 1400,
  // 칩이 바뀌고 버튼과 독이 자리를 접는 것까지 보고 나서 요약으로 넘어간다.
  end: 1300,
  review: 640,
};

/** 대목에 들어설 때의 진행값. 질의만 「생각하는 중」에서 시작한다. */
const enter = (beat: Beat | undefined) => (beat?.t === "ask" ? THINKING : 0);

/* ── 훅 ─────────────────────────────────────────────────────────────────── */

export type Demo = {
  /** 확정된 스크립트 줄. */
  lines: Line[];
  /** 지금 받아 적는 중인 줄. 확정되면 `lines`의 마지막이 된다. */
  live: { line: Line; text: string } | null;
  /** 드러난 타임라인 줄 수(안건 포함). */
  entries: number;
  /** 드러난 검토 묶음 수. 0이면 아직 분석 중이다. */
  review: number;
  status: Status;
  /** 독의 ■가 지금 눌리는 중인가. */
  stopping: boolean;
  /** 「회의 종료」가 지금 눌리는 중인가. */
  pressing: boolean;
  noteTab: NoteTab;
  setNoteTab: (v: NoteTab) => void;
  /** **시간 순서로 쌓인다** — 앱의 대화도 그렇다. 방문자가 먼저 물은 왕복 위로 대본의 질의가 끼어들지 않는다. */
  turns: Turn[];
  /** 흐르는 중인 답의 진행값. 어느 turn의 것인지는 `typingAt`이 말한다. */
  typing: number | null;
  /** `typing`이 붙는 turn의 자리. 흐르는 것이 없으면 -1. 위치로 찾지 순서를 가정하지 않는다. */
  typingAt: number;
  ask: (item: Ask) => void;
  /** 방문자가 대본을 멈춰 두었나. 첫 렌더는 늘 거짓이라 SSR과 어긋나지 않는다. */
  paused: boolean;
  togglePaused: () => void;
};

/**
 * 화면에 들어왔나. **한 번 들어오면 계속 참이다** — 되돌아와서 또 도는 화면은 읽는 것을
 * 방해한다.
 *
 * 대본과 따로 두는 이유는 하나 더 있다. `ref`로 넘어가는 콜백을 훅의 반환 객체에 담으면
 * eslint가 그 객체 전체를 ref로 보고 「렌더 중에 ref를 읽는다」로 잡는다.
 */
export function useInView() {
  /** 지금 화면에 있나. 계속 본다 — 대본은 안 보이는 동안 쉬어야 한다. */
  const [visible, setVisible] = useState(false);
  /** 한 번이라도 들어왔나. 돌아온 뒤에도 처음처럼 굴지 않게 붙들어 둔다. */
  const [seen, setSeen] = useState(false);

  const attach = useCallback((el: HTMLElement | null) => {
    // `IntersectionObserver`가 없는 환경(옛 브라우저 · jsdom)에서는 대본이 안 돈다 —
    // 첫 화면이 이미 「도는 회의」라 그대로 두어도 말이 된다.
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const now = entries[0]?.isIntersecting ?? false;
        setVisible(now);
        if (now) setSeen(true);
      },
      { rootMargin: "-64px 0px" }
    );
    io.observe(el);
    // **끊지 않는다.** 한 번 보고 끊으면 아래로 내려간 뒤에도 대본이 계속 돌아,
    // 16ms 간격 상태 갱신과 큰 트리 두 벌 렌더가 페이지를 떠날 때까지 이어진다.
    return () => io.disconnect();
  }, []);

  return [visible, seen, attach] as const;
}

/**
 * `seen`은 제품 샷이 화면에 들어왔는가다. 들어오기 전에는 대본이 안 돈다 — 히어로를 읽는
 * 동안 혼자 끝나 있으면 아무도 못 본다.
 */
export function useDemo({
  visible,
  seen,
}: {
  /** 지금 화면에 있나. 안 보이면 대본을 쉰다. */
  visible: boolean;
  /** 한 번이라도 들어왔나. 되돌아와도 처음처럼 굴지 않게. */
  seen: boolean;
}): Demo {
  const [raw, setCursor] = useState(0);
  const [progress, setProgress] = useState(0);
  const [noteOverride, setNoteOverride] = useState<NoteTab | null>(null);
  /**
   * 방문자가 직접 누른 질문. `at`은 **보낼 때 이미 서 있던 대본 질의의 수**다 — 그 값으로
   * 대본 질의 사이의 제자리에 끼운다. `id`는 자리와 무관한 `key`가 된다.
   */
  const [extra, setExtra] = useState<
    Array<{ item: Ask; at: number; id: number }>
  >([]);
  const [manualTyping, setManualTyping] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  /**
   * 모션을 줄였으면 대본을 안 돌리고 끝 상태로 둔다. **`seen`이 참일 때만 본다** — 그
   * 렌더는 하이드레이션 뒤에만 일어나므로 서버와 첫 클라이언트 렌더가 어긋나지 않는다.
   */
  const skip = seen && prefersReducedMotion();
  const cursor = skip ? LAST : raw;
  const done = cursor >= LAST;
  /**
   * **탭을 누른다고 멈추지 않는다.** 멈추는 것은 탭 이동뿐이고 그건 아래 `noteTab`이 판다.
   * 대신 **화면 밖이면 쉰다** — 안 보이는 동안 16ms 간격으로 상태를 갱신하며 큰 트리를 두
   * 벌 다시 그릴 이유가 없다. 그리고 일시정지 버튼으로 **방문자가 세우면** 선다.
   */
  const playing = visible && !skip && !done && !paused;

  /**
   * 손으로 보낸 답이 흐르는 중인가. **글자 수가 아니라 참·거짓이다** — 진행값을 그대로
   * 아래 타이머 효과의 의존성에 넣었더니 16ms마다 정리 함수가 돌아 **대본 타이머가 계속
   * 취소됐다.** 답이 흐르는 동안 스크립트와 타임라인까지 같이 멈췄다.
   */
  const manualBusy = manualTyping !== null;

  /**
   * 즉시 적용되는 대목은 커서가 **닿는 순간** 반영된다(탭 이동 · 타임라인 항목 · 중지 ·
   * 종료 · 검토 묶음). 글자가 흐르는 대목(말 · 질의)만 커서를 지나야 확정된다.
   */
  const view = useMemo(() => {
    const now = BEATS[cursor];
    const flowing = now?.t === "say" || now?.t === "ask";
    const settled = BEATS.slice(0, cursor);
    const seen = flowing ? settled : BEATS.slice(0, cursor + 1);

    const said = settled.filter((b) => b.t === "say").length;
    return {
      lines: TRANSCRIPT.slice(0, BASE_LINES + said),
      live:
        now?.t === "say"
          ? {
              line: TRANSCRIPT[now.i],
              text: TRANSCRIPT[now.i].text.slice(0, progress),
            }
          : null,
      entries: BASE_ENTRIES + seen.filter((b) => b.t === "event").length,
      review: seen.filter((b) => b.t === "review").length,
      status: (seen.some((b) => b.t === "end")
        ? "종료됨"
        : seen.some((b) => b.t === "pause")
          ? "중지됨"
          : "기록 중") as Status,
      stopping: now?.t === "stop",
      pressing: now?.t === "press",
      noteTab: seen.reduce<NoteTab>(
        (v, b) => (b.t === "note" ? b.v : v),
        "스크립트"
      ),
      scriptTurns: settled
        .filter((b): b is { t: "ask"; i: number } => b.t === "ask")
        .map((b) => ASKS[b.i]),
      scriptAsk: now?.t === "ask" ? ASKS[now.i] : null,
    };
  }, [cursor, progress]);

  /**
   * 한 바퀴가 끝나면 처음으로. **손댄 사람에게도 돈다** — 한때 안 돌렸는데, 아무거나 한 번
   * 눌렀다는 이유로 화면이 그 자리에 굳어 버려서 다시 볼 방법이 없었다.
   *
   * 돌 때 **고정과 손수 보낸 질문까지 되돌린다.** 탭이 못 박힌 채로 다시 돌면 대본이
   * 옮기려는 자리마다 막혀 반쪽만 보인다.
   */
  useEffect(() => {
    // **손수 보낸 답이 흐르는 동안에는 예약하지 않는다.** 남은 대기가 「생각 0.62초 +
    // 타이핑」보다 짧을 수 있어서, 예약해 두면 답이 중간에 지워진다. 답이 끝나면 이 효과가
    // 다시 돌아 그때부터 다시 잰다.
    //
    // 일시정지 중에도 안 돈다 — 끝 화면에서 멈춘 사람은 그 화면을 읽으려는 것이다. `paused`는
    // 되돌리지 않는다. 방문자가 고른 것이다.
    if (!visible || skip || !done || manualBusy || paused) return;
    const id = window.setTimeout(() => {
      setCursor(0);
      setProgress(0);
      setNoteOverride(null);
      setExtra([]);
      setManualTyping(null);
    }, LOOP_GAP);
    return () => window.clearTimeout(id);
  }, [visible, skip, done, manualBusy, paused]);

  /**
   * 대본이 지금 묻는 질문을 방문자가 **이미 물었나.** 그러면 대본은 다시 묻지 않고 지나간다 —
   * 같은 질문과 답이 두 번 서면 대본이 방문자의 말을 못 들은 것으로 읽힌다.
   */
  const here = BEATS[cursor];
  const repeated =
    here?.t === "ask" && extra.some((e) => e.item.q === ASKS[here.i].q);

  useEffect(() => {
    if (!playing) return;
    const beat = BEATS[cursor];
    if (!beat) return;
    /**
     * **손으로 보낸 답이 흐르는 동안 대본은 제 질의를 시작하지 않는다.** 둘이 겹치면 흐르는
     * 진행값은 하나뿐이라, 대본 turn이 통째로 완성된 채 떴다가 손수 답이 끝나는 순간 다시
     * 부분 문자열로 줄어든다. 앱 컴포저도 앞 턴이 끝나기 전에는 전송을 막는다.
     *
     * 말과 타임라인은 계속 흐른다 — 막는 것은 질의 대목 하나다.
     */
    if (beat.t === "ask" && manualBusy) return;

    const step = (ms: number, run: () => void) => {
      const id = window.setTimeout(run, ms);
      return () => window.clearTimeout(id);
    };
    const next = () =>
      setCursor((c) => {
        const upcoming = BEATS[c + 1];
        // 장면이 바뀌는 이동은 방문자가 못 박아 둔 탭도 이긴다 — 안 그러면 아무거나 한 번
        // 눌렀다는 이유로 장면 하나가 통째로 안 보인다.
        if (upcoming?.force) setNoteOverride(null);
        setProgress(enter(upcoming));
        return c + 1;
      });

    if (beat.t === "say") {
      const full = TRANSCRIPT[beat.i].text;
      return progress < full.length
        ? step(SAY_MS, () => setProgress((n) => n + 1))
        : step(HOLD.say, next);
    }
    if (beat.t === "ask") {
      if (repeated) return step(0, next);
      const full = ASKS[beat.i].a;
      if (progress === THINKING) return step(THINK_MS, () => setProgress(0));
      return progress < full.length
        ? step(16, () => setProgress((n) => Math.min(n + 2, full.length)))
        : step(HOLD.ask, next);
    }
    return step(beat.ms ?? HOLD[beat.t], next);
  }, [playing, cursor, progress, manualBusy, repeated]);

  /**
   * **손수 보낸 답이 흐르는 동안에는 대본의 질의를 아직 안 꺼낸다.** 위 효과가 막는 것은
   * `ask` 대목의 *진행*이지 *진입*이 아니다 — 앞 대목의 예약이 이미 터져 있으면 커서는
   * `ask`에 들어온 채로 멈춘다. 그대로 내보내면 그 turn을 가리키는 진행값이 없어 대본 답이
   * **완성본으로** 떴다가, 손수 답이 끝나는 순간 「생각하는 중」으로 되감긴다.
   *
   * 방문자가 이미 물은 질문이면 아예 안 꺼낸다 — 그 대목은 그냥 지나간다.
   */
  const scriptAsk = manualBusy || repeated ? null : view.scriptAsk;
  /** 지금 서 있는 대본 질의의 수. 손수 보낸 질문이 그 사이 어디에 끼는지를 정한다. */
  const shownAsks = view.scriptTurns.length + (scriptAsk ? 1 : 0);

  /** 손으로 보내는 질문. 대본과 같은 결로 흐른다(먼저 생각하고, 그다음 글자). */
  const ask = useCallback(
    (item: Ask) => {
      if (manualTyping !== null) return;
      setExtra((list) => [
        ...list,
        { item, at: shownAsks, id: list.length },
      ]);
      setManualTyping(prefersReducedMotion() ? null : THINKING);
    },
    [manualTyping, shownAsks]
  );

  useEffect(() => {
    if (manualTyping === null) return;
    const full = extra[extra.length - 1]?.item.a ?? "";
    if (manualTyping === THINKING) {
      const id = window.setTimeout(() => setManualTyping(0), THINK_MS);
      return () => window.clearTimeout(id);
    }
    // 끝을 타이머 안에서 판정한다 — 효과 본문에서 바로 `null`을 넣으면 렌더가 한 번 더
    // 도는 것을 eslint가 잡는다(`react-hooks/set-state-in-effect`).
    const id = window.setTimeout(
      () =>
        setManualTyping((n) =>
          n === null || n + 2 >= full.length ? null : n + 2
        ),
      16
    );
    return () => window.clearTimeout(id);
  }, [extra, manualTyping]);

  /**
   * 대화를 **시간 순서로** 쌓는다 — 대본 질의 `i` 앞에는 그것보다 먼저 보낸 방문자의 질문이
   * 선다. 대본 질의를 늘 방문자 것 앞에 두면, 먼저 물은 왕복 위로 나중 질문이 끼어들어 흐르는
   * 답이 대화 끝에서 떨어지고(바닥 따라가기가 엉뚱한 데 붙는다) 방문자의 왕복이 밀려난다.
   */
  const script = [...view.scriptTurns, ...(scriptAsk ? [scriptAsk] : [])];
  const visitor = (e: (typeof extra)[number]): Turn => ({
    ...e.item,
    key: `visitor-${e.id}`,
    mine: true,
  });
  const turns: Turn[] = [{ ...SEED, key: "seed", mine: false }];
  script.forEach((item, i) => {
    for (const e of extra) if (e.at === i) turns.push(visitor(e));
    // 방문자가 먼저 같은 것을 물었으면 대본의 왕복은 세우지 않는다.
    if (extra.some((e) => e.at <= i && e.item.q === item.q)) return;
    turns.push({ ...item, key: `script-${i}`, mine: false });
  });
  for (const e of extra) if (e.at >= script.length) turns.push(visitor(e));

  const streaming =
    manualTyping !== null
      ? `visitor-${extra.length - 1}`
      : scriptAsk
        ? `script-${script.length - 1}`
        : null;

  return {
    lines: view.lines,
    live: view.live,
    entries: view.entries,
    review: view.review,
    status: view.status,
    stopping: view.stopping,
    pressing: view.pressing,
    noteTab: noteOverride ?? view.noteTab,
    // 고른 탭이 곧 고정이다.
    setNoteTab: setNoteOverride,
    turns,
    typing:
      manualTyping !== null ? manualTyping : scriptAsk ? progress : null,
    typingAt:
      streaming === null ? -1 : turns.findIndex((t) => t.key === streaming),
    ask,
    paused,
    togglePaused: () => setPaused((p) => !p),
  };
}
