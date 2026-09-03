import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  CircleQuestionMark,
  SquareCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * 제품 화면이 **혼자 한 바퀴 돈다**. 회의가 도는 중에 말이 전사로 들어오고, 사건 흐름에
 * 쌓이고, 에이전트에게 묻고, 회의를 끝내면 요약이 나온다 — 랜딩이 문장으로 설명하던 순서를
 * 화면이 그대로 한 번 보여 준다.
 *
 * ## 앞으로만 간다
 *
 * 첫 렌더(= SSR = JS 끈 화면)가 **대본의 시작**이다. 회의 다섯 줄이 이미 적혀 있고 「기록
 * 중」이다. 거기서 앞으로만 흐르고, 끝나면 그 자리에 선다.
 *
 * 반대로 「끝난 화면을 먼저 그리고 되감는」 방식도 있었는데 그건 못 쓴다 — 하이드레이션
 * 뒤에 되감으면 다 찬 전사가 한 프레임 보였다가 비는 것이 보인다. 앞으로만 가면 그 깜빡임이
 * 아예 없다.
 *
 * ## 손대면 **탭만** 고정한다
 *
 * 방문자가 누르면 그 기둥의 탭을 그 자리에 못 박고(`noteOverride`·`railOverride`), **대본은
 * 계속 돈다.** 뺏지 말아야 할 것은 탭이지 내용이 아니다 — 누르자마자 화면이 딴 데로 가면
 * 눌러 보라고 해 놓고 뺏는 셈이지만, 거기서 대본까지 끊으면 이번엔 보여 주려던 것이
 * 통째로 사라진다. 전사를 고른 사람은 줄이 계속 들어오는 것을 보고, 사건 흐름을 고른
 * 사람은 카드가 계속 쌓이는 것을 본다.
 *
 * **고정은 만진 기둥에만 건다.** 노트 탭을 눌렀다고 레일까지 멈추지 않는다.
 *
 * 예외가 하나 있다. 회의가 끝나면 앱이 **요약 탭으로 넘긴다**(`meeting-controls.tsx`의
 * `onMeetingEnded` → `note-panel.tsx`). 그 이동은 대본이 부리는 것이 아니라 앱이 하는
 * 일이라 고정을 이긴다 — `force`가 붙은 대목이 그것이다.
 *
 * 모션을 줄인 사람에게는 대본을 아예 안 돌린다. 처음부터 끝 상태다.
 */

/* ── 이 회의 ────────────────────────────────────────────────────────────── */

export type Line = { at: string; who: string; text: string };

export const TRANSCRIPT: Line[] = [
  { at: "00:00", who: "김민서", text: "이번 스프린트는 온보딩 이탈부터 봅니다. 지난주에 남긴 가설 두 개를 먼저 정리하죠." },
  { at: "00:14", who: "박지훈", text: "지난 회의에서 결제 화면 개편은 다음으로 미뤘습니다. 그 결정 그대로 갑니다." },
  { at: "00:31", who: "이서연", text: "저는 이번에 합류해서 그 맥락을 모릅니다. 왜 미뤘는지 다시 볼 수 있을까요?" },
  { at: "00:44", who: "김민서", text: "에이전트가 근거를 붙여 뒀어요. 오른쪽 정리에서 결정 항목을 펼치면 됩니다." },
  { at: "01:02", who: "정우재", text: "그럼 온보딩 이탈 로그 수집은 제가 맡겠습니다. 이번 주 목요일까지 초안 올릴게요." },
  { at: "01:19", who: "박지훈", text: "좋습니다. 그 작업은 Linear 이슈로 바로 내보내는 게 좋겠어요." },
  { at: "01:33", who: "이서연", text: "그 이슈에 이 회의 결정을 근거로 같이 붙여 주세요. 다음에 들어올 사람도 볼 수 있게요." },
  { at: "01:48", who: "김민서", text: "네. 승인 화면에서 확인하고 내보내겠습니다. 오늘 남길 건 여기까지입니다." },
];

/**
 * 「회의 정보」 표. 라벨은 `note-details.tsx`의 `Fact`가 쓰는 것 그대로다.
 *
 * `ended`가 붙은 줄은 **종료된 뒤에만** 선다 — 누적 기록 시간은 기록 중에 아예 안 적는다
 * (`note-details.tsx`).
 */
export const FACTS: Array<{ k: string; v: string; ended?: true }> = [
  { k: "진행자", v: "김민서 · 기록 제어 권한" },
  { k: "누적 기록 시간", v: "01:52", ended: true },
  { k: "공유 범위", v: "워크스페이스 멤버에게 공개" },
  { k: "생성", v: "2026년 9월 1일 오후 2:00" },
  { k: "최종 수정", v: "2026년 9월 1일 오후 2:02" },
];

/** 요약 탭. 라벨과 순서는 `lib/notes/analysis-sections.ts`가 정한 것 그대로다. */
export const SUMMARY: Array<[string, Array<[string, string]>]> = [
  [
    "개요",
    [["온보딩 이탈을 이번 스프린트의 첫 기준선으로 잡고, 결제 화면 개편은 뒤로 미뤘습니다.", "00:00"]],
  ],
  [
    "액션 아이템",
    [
      ["온보딩 이탈 로그 수집 초안을 목요일까지 올립니다.", "01:02"],
      ["정리된 업무를 Linear 이슈로 내보냅니다.", "01:19"],
    ],
  ],
  ["결정", [["결제 화면 개편은 다음 스프린트로 미룹니다.", "00:14"]]],
];

/**
 * 사건 흐름. **차례가 곧 뜨는 순서다** — 앞의 `BASE_EVENTS`개는 처음부터 있고 나머지는
 * 대본이 하나씩 올린다.
 *
 * 메타는 실제 컴포넌트가 붙이는 말만 쓴다 — 유형, 동작(새로 포착 · 내용 보강 · 내용 정정 ·
 * 철회 · 질문 해결), 상태(철회됨 · 답변됨 · 답 대기), 그리고 「수정 N」.
 */
export type Outcome = "결론" | "논의 중" | "참고";
export type ContextKind = "결정" | "할 일" | "질문";
export type Item = {
  kind: ContextKind;
  title: string;
  at: string;
  more: number;
  meta: string;
  metaSm: string;
  outcome: Outcome;
};

export const CONTEXT: Item[] = [
  { kind: "결정", title: "결제 화면 개편은 다음 스프린트로 미룬다", at: "00:14", more: 3, meta: "결정 · 내용 보강", metaSm: "내용 보강", outcome: "결론" },
  { kind: "질문", title: "결제 화면 개편을 미룬 이유는 무엇인가", at: "00:31", more: 2, meta: "질문 · 답변됨 · 수정 1", metaSm: "답변됨 · 수정 1", outcome: "참고" },
  { kind: "결정", title: "온보딩 이탈 지표를 이번 주 기준선으로 삼는다", at: "00:52", more: 2, meta: "결정 · 수정 1", metaSm: "수정 1", outcome: "결론" },
  { kind: "할 일", title: "온보딩 이탈 로그 수집 초안 · 목요일", at: "01:02", more: 2, meta: "할 일", metaSm: "", outcome: "논의 중" },
  { kind: "할 일", title: "카드 결제 실패 재시도 정책 정하기", at: "01:19", more: 1, meta: "할 일 · 수정 1", metaSm: "수정 1", outcome: "논의 중" },
];

/**
 * 아이콘은 `lib/notes/context-candidates/presentation.ts`의 `CONTEXT_KIND_ICON` 그대로다.
 * 묶음 머리와 카드가 **같은 아이콘**을 쓴다(앱이 그렇다).
 */
export const CONTEXT_ICON: Record<ContextKind, LucideIcon> = {
  결정: CircleCheck,
  "할 일": SquareCheck,
  질문: CircleQuestionMark,
};

/** 묶음이 서는 차례. 앱의 레일과 같다. */
export const CONTEXT_KINDS: ContextKind[] = ["결정", "할 일", "질문"];

export const OUTCOMES = ["전체", "결론", "논의 중", "참고"] as const;
export type Scope = (typeof OUTCOMES)[number];

export const NOTE_TABS = ["정보", "전사", "요약"] as const;
export type NoteTab = (typeof NOTE_TABS)[number];

export const RAIL_TABS = ["실시간 정리", "내 에이전트"] as const;
export type RailTab = (typeof RAIL_TABS)[number];

/**
 * 「내 에이전트」의 왕복.
 *
 * **답은 이 회의에 실제로 있는 말만 쓴다** — 위의 `TRANSCRIPT` · `CONTEXT` · `SUMMARY`에서
 * 짚을 수 있는 것뿐이다. 화면 어디에도 없는 사실을 답하면, 「사실 대조판」이라고 말하는
 * 페이지가 제 말을 먼저 어긴다.
 *
 * `SEED`는 처음부터 떠 있는 왕복이라 탭을 열자마자 빈 화면이 아니다.
 */
export type Ask = { q: string; a: string; refs: string[] };

export const SEED: Ask = {
  q: "결제 화면 개편은 왜 미뤘나요?",
  a: "온보딩 이탈 지표를 먼저 보기로 해서 다음 스프린트로 미뤘습니다. 2차 회의에서 정해진 결정입니다.",
  refs: ["2차 회의", "이번 회의"],
};

export const ASKS: Ask[] = [
  {
    q: "정해진 할 일은 뭔가요?",
    a: "둘입니다. 온보딩 이탈 로그 수집 초안을 목요일까지 올리기로 했고, 카드 결제 실패 재시도 정책을 정하기로 했습니다. 둘 다 아직 논의 중으로 남아 있습니다.",
    refs: ["이번 회의"],
  },
  {
    q: "온보딩 이탈을 왜 먼저 보나요?",
    a: "온보딩 이탈 지표를 이번 주 기준선으로 삼기로 해서입니다. 지난주에 남긴 가설 두 개를 먼저 정리하기로 했습니다.",
    refs: ["이번 회의"],
  },
  {
    q: "제가 없던 사이에 뭐가 정해졌나요?",
    a: "결정 둘입니다. 결제 화면 개편은 다음 스프린트로 미루고, 온보딩 이탈 지표를 이번 주 기준선으로 삼기로 했습니다. 미룬 이유는 2차 회의에 남아 있습니다.",
    refs: ["2차 회의", "이번 회의"],
  },
];

/* ── 대본 ───────────────────────────────────────────────────────────────── */

/** 「생각하는 중」을 뜻하는 진행값. 0 이상은 드러난 글자 수라 음수 하나를 따로 쓴다. */
export const THINKING = -1;

/** 답이 흐르기 전에 머무는 시간. 앱에서 첫 델타가 오기까지와 비슷한 길이다. */
const THINK_MS = 620;

/** 처음부터 적혀 있는 전사 줄과 사건. 대본은 그 뒤부터 이어 붙인다. */
export const BASE_LINES = 5;
export const BASE_EVENTS = 3;

type Beat = { ms?: number; force?: true } & (
  | { t: "say"; i: number }
  | { t: "event" }
  | { t: "rail"; v: RailTab }
  | { t: "note"; v: NoteTab }
  | { t: "ask"; i: number }
  | { t: "end" }
  | { t: "summary" }
);

/**
 * 회의 한 대목. **전사 → 사건 흐름 → 에이전트 → 종료 → 요약** 순서로, 랜딩이 아래에서
 * 글로 설명하는 차례와 같다.
 *
 * 말과 사건을 번갈아 둔다 — 레일은 전사보다 조금 늦게 따라오는 것이 실제 모습이다.
 */
const BEATS: Beat[] = [
  { t: "say", i: 5 },
  { t: "event" },
  { t: "say", i: 6 },
  { t: "event" },
  { t: "say", i: 7 },
  { t: "rail", v: "내 에이전트" },
  { t: "ask", i: 2 },
  { t: "end" },
  // 종료 직후의 요약 탭은 「회의를 정리하고 있습니다」다. 그 화면이 지나가도록 길게 쉰다.
  // `force` — 회의가 끝나면 앱이 요약 탭으로 넘긴다. 방문자가 고정해 둔 탭도 이건 이긴다.
  { t: "note", v: "요약", ms: 1700, force: true },
  { t: "summary" },
  { t: "summary" },
  { t: "summary" },
];

export const LAST = BEATS.length;

/** 「회의 종료」를 누르면 여기로 건너뛴다. 앞의 말과 사건은 지나온 것으로 친다. */
const END_AT = BEATS.findIndex((b) => b.t === "end");

/** 한 글자가 전사에 찍히는 간격과, 줄이 확정된 뒤 다음 말까지 쉬는 시간. */
const SAY_MS = 26;
const HOLD: Record<Beat["t"], number> = {
  say: 560,
  event: 950,
  rail: 780,
  note: 780,
  ask: 1500,
  end: 1100,
  summary: 640,
};

/** 대목에 들어설 때의 진행값. 질의만 「생각하는 중」에서 시작한다. */
const enter = (beat: Beat | undefined) =>
  beat?.t === "ask" ? THINKING : 0;

/* ── 훅 ─────────────────────────────────────────────────────────────────── */

export type Demo = {
  /** 확정된 전사 줄. */
  lines: Line[];
  /** 지금 받아 적는 중인 줄. 확정되면 `lines`의 마지막이 된다. */
  live: { line: Line; text: string } | null;
  /** 드러난 사건 수. */
  events: number;
  /** 드러난 요약 절 수. 0이면 아직 정리 중이다. */
  summary: number;
  ended: boolean;
  noteTab: NoteTab;
  railTab: RailTab;
  setNoteTab: (v: NoteTab) => void;
  setRailTab: (v: RailTab) => void;
  turns: Ask[];
  typing: number | null;
  ask: (item: Ask) => void;
  /** 레일을 만졌다 — 레일 탭만 그 자리에 못 박는다. 대본은 계속 돈다. */
  pinRail: () => void;
  /** 「회의 종료」를 눌렀다 — 남은 말과 사건을 지나 종료 대목으로 건너뛰고 이어서 돈다. */
  endMeeting: () => void;
};

/**
 * 화면에 들어왔나. **한 번 들어오면 계속 참이다** — 되돌아와서 또 도는 화면은 읽는 것을
 * 방해한다.
 *
 * 대본과 따로 두는 이유는 하나 더 있다. `ref`로 넘어가는 콜백을 훅의 반환 객체에 담으면
 * eslint가 그 객체 전체를 ref로 보고 「렌더 중에 ref를 읽는다」로 잡는다.
 */
export function useInView() {
  const [seen, setSeen] = useState(false);
  const attach = useCallback(
    (el: HTMLElement | null) => {
      // `IntersectionObserver`가 없는 환경(옛 브라우저 · jsdom)에서는 대본이 안 돈다 —
      // 첫 화면이 이미 「도는 회의」라 그대로 두어도 말이 된다.
      if (!el || seen || typeof IntersectionObserver === "undefined") return;
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries[0]?.isIntersecting) return;
          setSeen(true);
          io.disconnect();
        },
        { rootMargin: "-64px 0px" }
      );
      io.observe(el);
      return () => io.disconnect();
    },
    [seen]
  );
  return [seen, attach] as const;
}

const reduced = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * `seen`은 제품 샷이 화면에 들어왔는가다. 들어오기 전에는 대본이 안 돈다 — 히어로를 읽는
 * 동안 혼자 끝나 있으면 아무도 못 본다.
 */
export function useDemo(seen: boolean): Demo {
  const [raw, setCursor] = useState(0);
  const [progress, setProgress] = useState(0);
  const [noteOverride, setNoteOverride] = useState<NoteTab | null>(null);
  const [railOverride, setRailOverride] = useState<RailTab | null>(null);
  /** 방문자가 직접 누른 질문. 대본의 것 뒤에 붙는다. */
  const [extra, setExtra] = useState<Ask[]>([]);
  const [manualTyping, setManualTyping] = useState<number | null>(null);

  /**
   * 모션을 줄였으면 대본을 안 돌리고 끝 상태로 둔다. **`seen`이 참일 때만 본다** — 그
   * 렌더는 하이드레이션 뒤에만 일어나므로 서버와 첫 클라이언트 렌더가 어긋나지 않는다.
   */
  const skip = seen && reduced();
  const cursor = skip ? LAST : raw;
  const done = cursor >= LAST;
  // **누른다고 멈추지 않는다.** 멈추는 것은 탭 이동뿐이고 그건 아래 `noteTab`·`railTab`이 판다.
  const playing = seen && !skip && !done;

  /**
   * 즉시 적용되는 대목은 커서가 **닿는 순간** 반영된다(탭 이동 · 사건 · 종료 · 요약 절).
   * 글자가 흐르는 대목(말 · 질의)만 커서를 지나야 확정된다.
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
      events: BASE_EVENTS + seen.filter((b) => b.t === "event").length,
      summary: seen.filter((b) => b.t === "summary").length,
      ended: seen.some((b) => b.t === "end"),
      noteTab: seen.reduce<NoteTab>((v, b) => (b.t === "note" ? b.v : v), "전사"),
      railTab: seen.reduce<RailTab>(
        (v, b) => (b.t === "rail" ? b.v : v),
        "실시간 정리"
      ),
      scriptTurns: settled
        .filter((b): b is { t: "ask"; i: number } => b.t === "ask")
        .map((b) => ASKS[b.i]),
      scriptAsk: now?.t === "ask" ? ASKS[now.i] : null,
    };
  }, [cursor, progress]);

  /** 레일을 만졌다. 지금 보고 있는 탭을 그대로 못 박는다 — 내용은 계속 흐른다. */
  const pinRail = useCallback(() => {
    setRailOverride((v) => v ?? view.railTab);
  }, [view.railTab]);

  /**
   * 「회의 종료」. 남은 말과 사건은 **지나온 것으로 친다** — 커서를 종료 대목으로 옮기면
   * 그 앞의 대목이 전부 확정된 것으로 파생되므로 전사 여덟 줄과 사건 다섯이 다 선다.
   *
   * 통째로 건너뛰지 않고 여기까지만 감는 이유는, 종료 뒤가 이 대본에서 가장 볼 만한
   * 대목이기 때문이다 — 칩이 바뀌고, 요약 탭이 열리고, 정리가 절 단위로 선다.
   */
  const endMeeting = useCallback(() => {
    setCursor((c) => Math.max(c, END_AT));
    setProgress(0);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const beat = BEATS[cursor];
    if (!beat) return;

    const step = (ms: number, run: () => void) => {
      const id = window.setTimeout(run, ms);
      return () => window.clearTimeout(id);
    };
    const next = () =>
      setCursor((c) => {
        const upcoming = BEATS[c + 1];
        // 앱이 하는 이동은 방문자가 못 박아 둔 탭도 이긴다(회의가 끝나면 요약 탭이다).
        if (upcoming?.t === "note" && upcoming.force) setNoteOverride(null);
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
      const full = ASKS[beat.i].a;
      if (progress === THINKING) return step(THINK_MS, () => setProgress(0));
      return progress < full.length
        ? step(16, () => setProgress((n) => Math.min(n + 2, full.length)))
        : step(HOLD.ask, next);
    }
    return step(beat.ms ?? HOLD[beat.t], next);
  }, [playing, cursor, progress]);

  /** 손으로 보내는 질문. 대본과 같은 결로 흐른다(먼저 생각하고, 그다음 글자). */
  const ask = useCallback(
    (item: Ask) => {
      pinRail();
      if (manualTyping !== null) return;
      setExtra((list) => [...list, item]);
      setManualTyping(reduced() ? null : THINKING);
    },
    [manualTyping, pinRail]
  );

  useEffect(() => {
    if (manualTyping === null) return;
    const full = extra[extra.length - 1]?.a ?? "";
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

  return {
    lines: view.lines,
    live: view.live,
    events: view.events,
    summary: view.summary,
    ended: view.ended,
    noteTab: noteOverride ?? view.noteTab,
    railTab: railOverride ?? view.railTab,
    // 고른 탭이 곧 고정이다. **만진 기둥에만 건다** — 노트를 눌렀다고 레일까지 멈추지 않는다.
    setNoteTab: setNoteOverride,
    setRailTab: setRailOverride,
    turns: [
      SEED,
      ...view.scriptTurns,
      ...(view.scriptAsk ? [view.scriptAsk] : []),
      ...extra,
    ],
    typing: manualTyping !== null ? manualTyping : view.scriptAsk ? progress : null,
    ask,
    pinRail,
    endMeeting,
  };
}
