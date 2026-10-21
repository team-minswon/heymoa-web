import { useMessages } from "next-intl";

import type { Demo, NoteTab } from "@/components/heymoa/landing/use-demo";
import type { TimelineTone } from "@/lib/notes/proposals/timeline";

/*
 * 히어로 창의 데이터와 장면 판정. 회의 자체(대본 · 스크립트 · 타임라인 · 질의)는 `use-demo.ts` 를 쓰고,
 * 여기는 **요약 탭 검토 문서**와 **지금 어느 장면인가**만 둔다.
 *
 * 검토 문서의 글은 언어 파일 `landing.demo.doc` 이다. 앱의 검토 줄은 「~한다」에 마침표가 없고, 요약 문단과
 * 주제 요지는 「~했다.」 산문이다(앱 요약 탭 캡처: 「…확정하기로 했다」 · 「…넘겼다」) — 아래 근거 구간과
 * 회의 카드도 같은 문장을 쓴다. 구조(시각 · 개수 · 근거 줄 · 담당 라벨)는 여기 두고 차례로 짝짓는다.
 */

const TOPICS: Array<{ at: string; counts: Array<[TimelineTone, number]> }> = [
  { at: "00:00", counts: [["decision", 2]] },
  {
    at: "01:02",
    counts: [
      ["task", 2],
      ["open", 1],
    ],
  },
];
const DECISIONS = [
  { at: "00:00", cites: [0] },
  { at: "00:14", cites: [1] },
];
/** 담당은 화자 라벨이다 — 이 회의는 화자에 이름을 안 붙인 채 끝난다(앱도 「화자 D」로 쓴다). */
const TASKS = [
  { who: "D", due: true, at: "01:02" },
  { who: "B", due: false, at: "01:19" },
];

/** 요약 탭 검토 문서 한 벌. 결정의 주제는 둘 다 첫 주제(스프린트 우선순위)다. */
export function useDoc() {
  const doc = useMessages().landing.demo.doc;
  return {
    summary: doc.summary,
    topics: TOPICS.map((topic, i) => ({ ...topic, ...doc.topics[i] })),
    decisions: DECISIONS.map((decision, i) => ({
      ...decision,
      text: doc.decisions[i],
      topic: doc.topics[0].title,
    })),
    tasks: TASKS.map((task, i) => ({
      ...task,
      text: doc.tasks[i],
      due: task.due ? doc.due : null,
    })),
  };
}

/**
 * 히어로 한 바퀴의 장면. 쪽지 · 커서 · 섬광 · 자막이 이것만 보고 바뀐다.
 * listen 받아 적기 → timeline 타임라인으로 → task 할 일이 붙음 → open 열린 질문 → ask 내 에이전트 →
 * stop 독에서 중지 → paused 중지됨 → press 회의 종료 누름 → ended 종료됨 → analyzing 분석 대기 →
 * doc 검토 문서 → evidence 근거 발언 → confirm 검토 막대.
 */
export type Scene =
  | "listen"
  | "timeline"
  | "task"
  | "open"
  | "ask"
  | "stop"
  | "paused"
  | "press"
  | "ended"
  | "analyzing"
  | "doc"
  | "evidence"
  | "confirm";

/**
 * **타이머 없이 대본 상태만으로** 장면을 정한다. 그래서 일시정지(상태가 얼면 장면도 언다) · 모션 줄이기
 * (처음부터 끝 상태 = confirm) · 서버 렌더(첫 상태 = listen)가 따로 손대지 않아도 맞는다.
 */
export function sceneOf(
  d: Pick<Demo, "status" | "review" | "noteTab" | "pressing" | "stopping" | "turns" | "entries">
): Scene {
  if (d.status === "ended") {
    if (d.review === 0) return d.noteTab === "summary" ? "analyzing" : "ended";
    return d.review <= 2 ? "doc" : d.review === 3 ? "evidence" : "confirm";
  }
  if (d.pressing) return "press";
  if (d.status === "paused") return "paused";
  if (d.stopping) return "stop";
  if (d.turns.some((t) => t.key.startsWith("script-"))) return "ask";
  if (d.entries >= 9) return "open";
  if (d.entries === 8) return "task";
  if (d.noteTab === "timeline") return "timeline";
  return "listen";
}

/**
 * 장면이 기대하는 노트 탭. 방문자가 다른 탭을 눌러 두었으면 그 장면의 **노트 본문용** 쪽지 · 커서 ·
 * 섬광을 숨긴다(가리킬 것이 화면에 없다). 없는 장면은 레일 · 독 · 상단바라 탭과 무관하다.
 */
export const SCENE_TAB: Partial<Record<Scene, NoteTab>> = {
  listen: "script",
  timeline: "timeline",
  task: "timeline",
  open: "timeline",
  analyzing: "summary",
  doc: "summary",
  evidence: "summary",
  confirm: "summary",
};

/** 장 줄의 차례(이름은 `landing.demo.chapters`). */
export const CHAPTER_OF: Record<Scene, number> = {
  listen: 0,
  timeline: 1,
  task: 1,
  open: 1,
  ask: 2,
  stop: 3,
  paused: 3,
  press: 3,
  ended: 3,
  analyzing: 3,
  doc: 4,
  evidence: 4,
  confirm: 4,
};

/**
 * 붙잡는 순간. 장면 입구(`Scene`)에 더해, 장면 **안에서** 쪽지 · 말풍선이 새로 서는 네 순간이 있다 — 받아
 * 적기의 말이 다 적힌 때(`typed`), 할 일 장면에서 01:33 의 말(열린 질문이 될 말)이 다 적힌 때(`asked`),
 * 01:48 의 말(항목이 안 되는 말)이 다 적힌 때(`idle`), 회의 중 질의의 답이 다 흐른 때(`answered`).
 */
export type Moment = Scene | "typed" | "asked" | "idle" | "answered";

/**
 * 타임라인에 새 줄이 다 들어오는 시간(ms). 새 줄은 이만큼 걸려 들고(`hero-note.tsx`), 그 줄을 말하는 것 —
 * 개수 튐 · 범례 줄 · 쪽지 · 자막 — 은 이만큼 늦게 선다. 같이 서면 멈춰 본 순간 「3」과 「답 못 한 질문」이
 * 아직 안 보이는 줄을 말했다.
 */
export const ROW_IN_MS = 300;

/**
 * 무대가 대본을 잠깐 붙잡아 두는 순간과 그 길이(ms). use-demo 의 박자는 고정이라(손댈 수 없다) 쪽지가
 * 1.1~1.9초 만에 지나가 읽기 전에 사라졌다. 그래서 **쪽지 · 자막 · 말풍선은 모두 3초 넘게 선다**가 되도록
 * 붙잡는다 — 두 줄 쪽지를 읽고 화살표를 따라 창 안의 새 줄 · 아이콘을 찾아보는 시간이다(2.5초 바닥값일 때는
 * 「방금 나온 할 일」이 2.5초라 빠듯했다). 붙잡는 동안 대본은 화면 밖에 있을 때처럼 쉬고(`visible` 거짓),
 * 반복 대기(`LOOP_GAP`)도 같이 선다 — 일시정지 · 모션 줄이기와는 따로 논다. 한 바퀴는 약 47초다(실측 1440 46.7 ·
 * 1366 46.4 · 390 45.4초에 이번에 늘린 `typed` · `evidence` 0.6초를 더한 값, 첫 바퀴는 시작 대기 0.8초가 더해진다).
 *
 * 붙잡기는 순간에 들어선 **그 렌더에서** 걸린다(`hero-stage.tsx`) — 대본의 다음 박자는 붙잡기가 풀린 뒤에
 * 처음부터 다시 잰다. 쪽지를 비트 뒤로 끌고 가는(남겨 두는) 방식은 쓰지 않았다. 남은 쪽지가 이미 지나간
 * 줄을 가리키고, 자막은 한 자리라 다음 자막을 밀어내기만 한다.
 *
 * 괄호 셈은 **실제로 보이는 시간**이다 — 늦게 튀어나오는 만큼(`delay`)과 `tv-pop` 이 불투명도 0.5 에 닿는
 * 약 0.1초를 뺐다(앞의 투명한 동안은 안 보인다, fill 이 both). 직전 회차에 이 둘을 안 빼서 「2.6초」라 적은
 * 쪽지가 실측 2.4~2.5초였다. 셈의 바탕은 같은 방법(0.1초 간격, 조상까지 곱한 불투명도 0.5 이상)으로 한 바퀴
 * 전체를 잰 실측이다.
 */
export const HOLD_MS: Partial<Record<Moment, number>> = {
  /**
   * 「말이 끝나면 시각을 붙여 한 줄씩 적습니다」(말 0.96 + 1.7 + 0.56 − 0.1 ≈ 3.1초). 그사이 커서가 「타임라인」 탭에 와 선다.
   * 1.5 일 때 1024 · 1366×650 실측이 3.0초로 여유가 없었다.
   */
  typed: 1700,
  /** 「방금 나온 할 일이 벌써 붙었습니다」(`ROW_IN_MS` 0.3 지연: 2.8 + 0.7 − 0.3 − 0.1 = 3.1초). */
  task: 2800,
  /**
   * 01:33 의 회의실 말풍선(말 1.2 + 1.4 + 0.56 − 0.1 ≈ 3.1초). 이 말이 곧 열린 질문 줄이 되는데, 붙잡기가
   * 없어서 말풍선 셋 가운데 이것만 1.8초 만에 사라졌다(01:19 는 `typed`, 01:48 은 `idle` 이 붙잡는다).
   */
  asked: 1400,
  /** 「답하지 못한 질문은 주황 점선으로 남습니다」(`ROW_IN_MS` 0.3 지연: 2.8 + 0.7 − 0.3 − 0.1 = 3.1초). */
  open: 2800,
  /** 「모든 말이 항목이 되지는 않습니다」(말 0.8 + 1.8 + 0.56 − 0.1 ≈ 3.1초). */
  idle: 1800,
  /**
   * 「답 아래에 참고한 회의록이 붙습니다」(1.7 + 1.5 − 0.1 = 3.1초). 이 길이는 **xl 이상**이다 — 그 손글씨는
   * 넓은 거터에만 서고, 좁은 화면은 레일이 첫 화면 밖이라 다 붙잡으면 노트 창만 멈춰 있다. 좁은 화면은
   * `ANSWERED_NARROW_MS` 만큼만 붙잡는다(`hero-stage.tsx`).
   */
  answered: 1700,
  /** 좁은 화면 자막 「① 먼저 멈춥니다」(1.8 + 1.4 − 0.1 = 3.1초). 커서는 이 동안 ■ 위에 와 있고, 풀리면 누른다. */
  stop: 1800,
  /** 「② 그다음 회의 종료」(0.25 지연: 1.2 + 0.9 + 1.4 − 0.25 − 0.1 ≈ 3.15초). 중지됨 · 누름 두 장면 동안 선다. */
  paused: 1200,
  /** 「회의가 끝나면 요약 탭으로 넘어갑니다」(1.9 + 1.3 − 0.1 = 3.1초). */
  ended: 1900,
  /** 「여기서는 분석을 빨리 감습니다」(1.5 + 1.7 − 0.1 = 3.1초). */
  analyzing: 1500,
  /** 「요약 탭이 회의록 한 장이 됩니다」(1.9 + 0.64 × 2 − 0.1 ≈ 3.1초). 「검토 중」 머리가 선 화면을 이만큼 보인다. */
  doc: 1900,
  /**
   * 좁은 화면 자막 「결정이 나온 대목까지」(2.9 + 0.64 − 0.1 ≈ 3.4초). 넓은 화면 쪽지 「이 결정이 나온 대목입니다」는
   * 문서가 굴러가 인용 줄이 창에 다 든 뒤에 0.4초 늦게 튀어나온다(`hero-stage.tsx`, 2.9 + 0.64 − 0.4 − 0.1 ≈ 3.0초).
   * 높은 창에서는 검토 막대 장면까지 서지만, 낮은 창(1366×650)에서는 그 장면에 인용 줄이 창 밖이라 숨으므로 이
   * 장면만으로 3초를 넘겨야 한다 — 2.5 일 때는 2.6초 남짓이었다.
   */
  evidence: 2900,
  confirm: 2000,
};

/** 좁은 화면의 `answered` 붙잡기 — 자막 「회의 중에도 물어봅니다 ↓」(실측 2.8초)가 3초를 넘기는 만큼. */
export const ANSWERED_NARROW_MS = 400;

/*
 * 넓은 거터가 없는 화면(xl 미만)의 한 장짜리 자막은 `landing.demo.captions` 에 장면마다 있다. 한국어는 20자
 * 안이다. 「먼저 멈춥니다」 · 「검토 완료」는 lg 미만에서 「 ↓」를 단다(`hero-stage.tsx`) — 독 · 검토 막대는 늘
 * 창 바닥이라 짧은 휴대폰 높이(390×664 · 375×553)에서는 첫 화면 밖이다. 물어보기의 「↓」와 같은 까닭이다.
 * 무대는 **글자가 바뀔 때만** 새로 튀어나오게 한다(`key` 가 글자) — 그래서 짧게 지나가는 타임라인 · 할 일
 * 장면은 같은 자막을 나눠 쓴다. 자막마다 3초 넘게 서는 것은 위 `HOLD_MS` 가 맞춘다. 열린 질문 장면의 자막은
 * 그 줄이 든 뒤(`ROW_IN_MS`)에 선다. 타임라인 자막에 「결정·할 일·질문만」이라고 하면 같은 창의 「참고 2」(답한
 * 질문 · 인사이트)와 어긋난다. 분석 자막은 창 안 「>>>」 표시(글자 없음)와 짝이다. 요약 자막은 「완성」이라 하지
 * 않는다 — 이 화면의 머리는 아직 「검토 중」이고, 검토 완료를 누르기 전엔 프로젝트에 안 올라간다.
 */
