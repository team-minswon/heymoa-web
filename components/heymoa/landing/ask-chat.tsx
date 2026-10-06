"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight } from "lucide-react";

import { ASKS, SEED, TITLE } from "@/components/heymoa/landing/use-demo";
import { cn } from "@/lib/utils";

import {
  Answer,
  AppWindow,
  Composer,
  Face,
  RailHead,
  ScopeChip,
  ThreadTitle,
  UserBubble,
} from "./app";
import { AnswerRefs } from "./app-client";
import { useFollowBottom, useOnceInView, useReducedMotion } from "./hooks";
import { Cursor, ExampleStamp, Scribble, Sticky } from "./marks";
import { CONTAINER, FOCUS, LABEL, SHADOW } from "./tokens";

/*
 * 내 에이전트 구간의 움직이는 쪽 — 누르는 질문 쪽지 셋과 「내 에이전트」 창이 상태를 같이 쓴다.
 * tl;dv 의 「AI Prompt Examples」(역할별 질문 카드)를 장면별로 바꿨고, 카드가 그냥 예시로 끝나지
 * 않고 **누르면 창에 실제로 들어가 답이 흐른다.**
 *
 * 창 안은 앱(`note-agent-rail.tsx` 머리 · `personal-chat.tsx` 제목 줄 · `chat-thread.tsx` 말풍선 ·
 * `chain-of-thought.tsx` 「참고한 회의록 N개」 · `chat-composer.tsx` 입력창)을 `app.tsx` 로 그린 것이고
 * 답은 `use-demo.ts` 의 `SEED` · `ASKS` 그대로다(지어 쓰지 않는다). 혼자 도는 장면은 히어로 레일이 쓰지
 * 않는 것만 맡는다: 지난 회의까지 넓혀 찾은 참고 둘을 **펼쳐** 보이기, 할 일 담당을 이름으로 짚는 답
 * (`ASKS[1]` — 이름을 붙여 둔 뒤의 회의).
 * 히어로 레일의 질문(`ASKS[2]`)은 누를 때만 들어가는 마지막 쪽지다. 승인 카드는 이 구간에 두지 않는다
 * (도구 연결 구간).
 *
 * 한 번 재생(화면에 45% 들어오면): 0.5s 커서가 「참고한 회의록 2개」로 → 1.0s 눌러 펼침 + 쪽지 →
 * 3.5s 「로그 수집은 누가 맡았나요?」가 들어가 생각하는 중 0.62s → 두 글자씩 흐름 → 형광펜 + 쪽지.
 * 둘째 질문을 3.5s 에 넣는 것은 첫 쪽지의 체류 때문이다 — 1400 미만의 띠는 쪽지 한 장만 세워서 둘째
 * 답이 다 흐르면 첫 쪽지를 갈아 끼운다. 전에는 1.8s 에 넣어 첫 쪽지가 약 2초 만에 바뀌었다(지금은 약 3.7초).
 * 방문자가 쪽지 질문을 누르면 둘째 왕복이 그 질문으로 바뀐다(흐르는 동안에는 받지 않는다).
 * 모션을 줄이면 처음부터 끝 상태(펼친 참고 · 둘째 답 전체 · 칠한 형광펜 · 쪽지)로 선다.
 *
 * 창 밖 쪽지 두 장은 넓은 화면(1400 이상 · CSS anchor 지원)에서 가리키는 줄 바로 옆 바깥에 붙는다 —
 * 줄 위치를 재지 않고 `anchor-name` 으로 따라가므로 대화가 스크롤돼도 같이 움직인다. 그 밖에서는
 * 창 아래 가장자리(입력창 밑 여백)에 띠 하나로 가장 최근 쪽지만 선다 — 최근 답이 바로 위에 있다.
 *
 * 창 밖 쪽지(옆 쪽지 · 띠)는 **붙는 첫 프레임이 곧 완성형이다** — 화살표는 처음부터 다 그려져 있고,
 * 쪽지는 다 보이는 채로 한 번 커졌다 돌아온다(`tv-bump`). 전에는 투명 · 80% 크기에서 튀어나오고
 * (`tv-pop`) 화살표를 선 긋기(`tv-draw`)로 그렸는데, 폭이 1400 을 넘나들어 `display` 가 바뀌면
 * 애니메이션이 처음부터 다시 돌아서 정지 화면(캡처)에 반투명 쪽지와 둥근 선 끝 점 하나만 남았다
 * (둘째 쪽지는 300ms 지연 안이라 아예 안 보였다). 어느 순간에 멈춰도 쪽지와 화살표가 한 덩어리다.
 *
 * 창 높이는 대화 길이만큼이다. 넓은 화면은 640 을 넘으면 대화가 안에서 스크롤한다(`max-h`). 전에는
 * 넓은 화면에서 640 고정이라 재생 전 · 재생 초반에 첫 답 아래 약 240px 가 빈 흰 면이었다 — 들어오는
 * 순간의 첫인상이 반쯤 빈 창이었다. 창이 자라도 아래 구간이 밀리지 않게 격자가 640 을 미리 잡는다
 * (`lg:min-h-[640px]`) — 자라는 몫은 창 아래 라벤더 면에서 나온다. 좁은 화면은 전부터 길이만큼 자랐다
 * (고정 높이에 바닥을 따라가면 앞 답의 꼬리부터 잘려 시작한다).
 *
 * 테두리는 창 하나뿐이다. 앱 입력창은 선 상자인데, 창 가장자리에서 20 · 16 안쪽에 같은 둥근 상자가 서면
 * 테두리 두 겹으로 읽힌다(사용자: 「테두리가 2개인 건 이상하다」). 그래서 입력창은 자리 · 모양 · 칩 ·
 * 보내기 버튼은 앱 그대로 두고 **선만 빼서 옅은 면**(`--el-canvas`)으로 세운다.
 *
 * 창 머리 부제 「나만 보는 대화 · 현재 회의 범위」는 앱처럼 한 줄 말줄임인데, 창 폭 320 미만(화면 360
 * 미만)에서는 「나만 보는 대화 · 현재 …」로 잘렸다. 그 폭에서는 부제를 머리 둘째 줄로 내려 다 읽히게
 * 한다(`HEAD_NARROW`) — 앱이 말줄임하는 줄을 줄바꿈해 다 보이는 것은 `app.tsx` 머리 주석 ①의 허용
 * 범위다. 숨기지 않는 까닭: 「현재 회의 범위」가 이 창이 이 회의부터 찾는다는 말이다.
 */

/**
 * 창 폭 320 미만에서 레일 머리를 두 줄로: 첫 줄 ✦ 내 에이전트 … 접기, 둘째 줄 부제(제목 글자 첫머리에
 * 맞춰 ✦ 15 + 간격 8 = 23 들여쓴다). 부제는 `RailHead` 의 유일한 `truncate` 자식이다.
 */
const HEAD_NARROW =
  "@max-xs:h-auto @max-xs:flex-wrap @max-xs:gap-y-0 @max-xs:pt-1 @max-xs:pb-2.5 @max-xs:[&>.truncate]:order-last @max-xs:[&>.truncate]:basis-full @max-xs:[&>.truncate]:pl-[23px]";

/**
 * 질문 쪽지 셋. 답과 참고는 `ASKS` 그대로이고, `mark` 는 답 안에서 형광펜을 칠할 구절이다.
 * 차례는 `ASKS` 와 같다(i 번째 쪽지 = `ASKS[i]`). 히어로 레일이 이미 묻는 「제가 없던 사이에 뭐가
 * 정해졌나요?」(`ASKS[2]`)는 맨 아래다 — 전에는 맨 위 쪽지라 히어로에서 본 질문이 이 구간 첫 질문으로
 * 다시 나왔다. 빼지 않는 까닭: 명대사 벽의 「저 그때 없었는데요」를 받는 장면이다. 색 · 기울기 ·
 * 들여쓰기는 자리에 붙어 있어(노랑 → 흰 → 버터) 차례를 바꿔도 리듬은 같다.
 */
const QUESTIONS: {
  scene: string;
  who: string;
  ask: (typeof ASKS)[number];
  mark: string;
  note: readonly [string, string];
  look: string;
  tilt: string;
  indent: string;
}[] = [
  {
    scene: "딴생각하다 돌아와서",
    who: "박지훈",
    ask: ASKS[0],
    mark: "지난주에 남긴 가설 두 개를 먼저 정리하자는 말",
    note: ["회의 첫마디에서", "찾아왔어요"],
    look: "bg-[var(--tv-pop)]",
    tilt: "-rotate-1 lg:-rotate-2",
    indent: "",
  },
  // 회의 카드 · 근거 구간처럼 화자 D 에 정우재라는 이름을 붙여 둔 뒤의 답이다(`ASKS[1]` 주석).
  // 묻는 사람은 이서연이다 — 01:33 에 그 작업의 이슈를 물은 사람이 며칠 뒤 초안을 기다리며 누구에게 물을지
  // 찾는다. 쪽지는 조건(이름을 붙여 둔 회의)까지 말한다 — 이름 없는 회의에서는 화자 라벨로 답하므로
  // 「이름으로 답한다」를 에이전트의 일반 성질로 넓히지 않는다(FAQ 06 「끝난 뒤 스크립트 탭에서 붙여 둡니다」).
  {
    scene: "로그 초안 기다리다가",
    who: "이서연",
    ask: ASKS[1],
    mark: "정우재입니다.",
    note: ["이름을 붙여 두면", "이름으로 답해요"],
    look: "border-[1.5px] border-[var(--tv-ink)] bg-white",
    tilt: "rotate-1 lg:rotate-[1.5deg]",
    indent: "lg:ml-8",
  },
  // 정우재는 01:02에 처음 말한다 — 그 앞의 결정 둘(00:00 · 00:14)을 놓친 사람으로 자연스럽다.
  {
    scene: "늦게 들어와서",
    who: "정우재",
    ask: ASKS[2],
    mark: "결정 둘입니다.",
    note: ["결정 둘만", "콕 집어 줘요"],
    look: "bg-[var(--tv-butter)]",
    tilt: "-rotate-1",
    indent: "lg:ml-3",
  },
];

/** 혼자 도는 장면이 넣는 질문 — 「로그 수집은 누가 맡았나요?」. */
const AUTO = 1;
/** 쪽지 글은 두 줄로 끊어 둔다 — 창 옆 쪽지는 이 두 줄로, 창 위 띠는 한 줄로 이어 쓴다. */
const NOTE_A = ["2차 회의록까지", "넓혀서 찾아왔어요"] as const;
/** 첫 답에서 칠할 구절 — 2차 회의록에서 가져온 대목이다. */
const SEED_MARK = "2차 회의에서 정한 결정";

/**
 * 답 본문(14px)용 형광펜 — `safety.tsx` 의 `PEN` 과 같은 띠(반투명 노랑 0.62em, 92% 자리)를 마운트 때
 * 칠한다(`tv-mark`). 제목용 `MARKER`(0.42em, 88%)는 이 크기에서 글자 아래쪽을 가로지르는 줄이 되어
 * 「철회됨」의 취소선처럼 읽혔다. 앞뒤 여백(-mx-1 px-1)이 없어서 구절 앞 공백을 칠하지 않는다.
 */
const PEN =
  "tv-mark bg-[linear-gradient(color-mix(in_srgb,var(--tv-pop)_55%,transparent),color-mix(in_srgb,var(--tv-pop)_55%,transparent))] bg-no-repeat [background-size:100%_0.62em] [background-position:0_92%] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";

/** 「생각하는 중」. 0 이상은 드러난 글자 수다(`use-demo.ts` 의 `THINKING` 과 같은 약속). */
const THINKING = -1;
const THINK_MS = 620;
const STEP = 2;
const STEP_MS = 16;
/** 둘째 질문(`auto`)은 첫 쪽지가 3초 넘게 서 있도록 늦춘다(머리 주석). */
const AT = { cursor: 500, press: 1000, cursorOff: 1700, auto: 3500 } as const;

type Run = { i: number; n: number; mine: boolean };

/** `mark` 구절만 감싼다. 데이터가 바뀌어 구절을 못 찾으면 칠하지 않고 글만 낸다. */
function Marked({
  text,
  mark,
  className,
}: {
  text: string;
  mark: string;
  className?: string;
}) {
  const at = text.indexOf(mark);
  if (!className || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className={className}>{mark}</span>
      {text.slice(at + mark.length)}
    </>
  );
}

/**
 * 창 밖 오른쪽에 붙는 쪽지(넓은 화면 전용). 세로 자리는 `anchor` 가 가리키는 줄의 가운데이고, 왼쪽
 * 화살표 끝이 창 가장자리 여백에 닿는다 — 창 안 글자는 가리지 않는다.
 * 화살표는 처음부터 다 그려져 있고 쪽지는 왼쪽(화살표 쪽)을 축으로 한 번 커졌다 돌아온다 — 첫
 * 프레임이 곧 완성형이라 화살표와 쪽지가 늘 한 덩어리로 보인다(머리 주석 참고).
 */
function SideNote({
  at,
  tone,
  tilt,
  children,
}: {
  at: "refs" | "mark";
  tone: "pop" | "butter";
  tilt: number;
  children: readonly [string, string];
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-[calc(100%+28px)] z-10 hidden -translate-y-1/2 items-center min-[1400px]:supports-[anchor-name:--a]:flex",
        at === "refs"
          ? "top-[anchor(center)] [position-anchor:--ask-refs]"
          : "top-[anchor(center)] [position-anchor:--ask-mark]"
      )}
    >
      <Scribble
        kind="arrow"
        flipX
        rotate={-14}
        className="absolute top-1/2 -left-9 h-6 w-9 -translate-y-1/2"
      />
      <Sticky
        tone={tone}
        size="sm"
        tilt={tilt}
        className="tv-bump w-max origin-left"
      >
        <span className="block">{children[0]}</span>
        <span className="block">{children[1]}</span>
      </Sticky>
    </span>
  );
}

export function AskChat({ heading }: { heading: ReactNode }) {
  const reduced = useReducedMotion();
  const [attach, seen] = useOnceInView<HTMLDivElement>({ threshold: 0.45 });
  const windowRef = useRef<HTMLDivElement | null>(null);
  const bind = useCallback(
    (el: HTMLDivElement | null) => {
      windowRef.current = el;
      return attach(el);
    },
    [attach]
  );

  /** 첫 답의 「참고한 회의록 2개」. `null` 은 아직 아무도 안 만진 것 — 앱 규칙대로 접혀 있다. */
  const [refsOpen, setRefsOpen] = useState<boolean | null>(null);
  const [cursor, setCursor] = useState(false);
  const [noteA, setNoteA] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [shown, setShown] = useState(THINKING);
  const [said, setSaid] = useState("");
  const started = useRef(false);
  const count = useRef(0);

  const start = useCallback((i: number, mine: boolean) => {
    started.current = true;
    count.current += 1;
    setRun({ i, n: count.current, mine });
    setShown(THINKING);
  }, []);

  // 한 번 재생. 방문자가 그 사이 질문을 눌렀으면 자동 질문은 건너뛴다.
  useEffect(() => {
    if (!seen || reduced) return;
    const timers = [
      window.setTimeout(() => setCursor(true), AT.cursor),
      window.setTimeout(() => {
        setRefsOpen((open) => open ?? true);
        setNoteA(true);
      }, AT.press),
      window.setTimeout(() => setCursor(false), AT.cursorOff),
      window.setTimeout(() => {
        if (!started.current) start(AUTO, false);
      }, AT.auto),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [seen, reduced, start]);

  // 둘째 왕복: 생각하는 중 → 두 글자씩. 다 흐르면 방문자가 누른 것만 읽어 준다.
  useEffect(() => {
    if (!run || reduced) return;
    const full = QUESTIONS[run.i].ask.a;
    let at = 0;
    let timer = 0;
    const tick = () => {
      at = Math.min(at + STEP, full.length);
      setShown(at);
      if (at < full.length) timer = window.setTimeout(tick, STEP_MS);
      else if (run.mine) setSaid(`답이 도착했습니다: ${full}`);
    };
    timer = window.setTimeout(tick, THINK_MS);
    return () => window.clearTimeout(timer);
  }, [run, reduced]);

  // 모션을 줄이면 타이머 없이 끝 상태를 그린다 — 자동 질문의 답까지 선 채로.
  const view = run ?? (reduced ? { i: AUTO, n: 0, mine: false } : null);
  const q = view ? QUESTIONS[view.i] : null;
  const full = q?.ask.a ?? "";
  const at = reduced ? full.length : shown;
  const done = q !== null && at >= full.length;
  const busy = q !== null && !done;
  const open = refsOpen ?? reduced;
  const showA = noteA || reduced;
  const noteB = q && done ? q.note : null;
  const band = noteB ?? (showA ? NOTE_A : null);

  const [convoRef, onScroll] = useFollowBottom([open, view?.n, at]);

  const ask = (i: number) => {
    if (busy) return;
    start(i, true);
    if (reduced) setSaid(`답이 도착했습니다: ${QUESTIONS[i].ask.a}`);
    // 좁은 화면에서는 창이 쪽지 아래에 있다 — 누른 것이 들어가는 자리가 보이게 한다.
    windowRef.current?.scrollIntoView({
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const chip = <ScopeChip kind="note" title={TITLE} />;

  return (
    <div
      className={`${CONTAINER} mt-16 grid gap-10 lg:mt-6 lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_540px] lg:items-start lg:gap-16`}
    >
      <div className="min-w-0">
        {heading}

        {/* 라벨은 쪽지가 하는 일(누르면 창에 질문이 들어간다)을 말한다 — 「물어보-」는 제목 · 리드가
            이미 두 번 한다(`ask.tsx` 머리 주석). */}
        <p
          id="ask-try"
          className={cn(LABEL, "m-0 mt-10 flex items-center gap-2")}
        >
          눌러서 넣어 보세요
          <Scribble kind="arrow" className="hidden h-5 w-8 lg:block" />
        </p>
        <ul
          aria-labelledby="ask-try"
          className="m-0 mt-4 flex list-none flex-col gap-4 p-0"
        >
          {QUESTIONS.map((item, i) => {
            const current = view?.i === i;
            return (
              <li key={item.scene}>
                <button
                  type="button"
                  aria-current={current || undefined}
                  aria-disabled={busy || undefined}
                  onClick={() => ask(i)}
                  className={cn(
                    "relative flex min-h-11 w-full max-w-[400px] cursor-pointer items-center gap-3 rounded-[14px] px-4 py-3.5 text-left lg:w-[calc(100%-2rem)]",
                    "motion-safe:transition-[rotate,translate,opacity] motion-safe:duration-200",
                    "motion-safe:not-aria-disabled:hover:-translate-y-0.5 motion-safe:not-aria-disabled:hover:rotate-0",
                    "aria-disabled:cursor-default aria-disabled:opacity-60",
                    SHADOW.sticky,
                    FOCUS,
                    item.look,
                    item.tilt,
                    item.indent
                  )}
                >
                  <Face
                    who={item.who}
                    size={32}
                    className="shrink-0 self-start"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] leading-[1.4] font-extrabold text-[var(--tv-body)]">
                      {item.scene}
                      <span className="sr-only">, </span>
                    </span>
                    <span className="mt-0.5 block text-[16px] leading-[1.45] font-extrabold break-keep text-[var(--tv-ink)]">
                      {item.ask.q}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--tv-ink)] text-white"
                  >
                    <ArrowRight className="size-3.5 max-lg:rotate-90" />
                  </span>
                  {current ? (
                    <span
                      aria-hidden
                      className="absolute -top-2.5 right-4 rounded-full bg-[var(--tv-ink)] px-2 py-0.5 text-[11px] leading-[1.4] font-extrabold text-white">
                      보는 중
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        ref={bind}
        className="relative mx-auto w-full max-w-[540px] min-w-0 scroll-mt-20 lg:sticky lg:top-24 lg:mx-0"
      >
        {/* 띠는 입력창 밑 여백(16)까지만 걸친다 — 기울어도 입력창 면에 닿지 않는 깊이다. 한 번
            커질 때도 위 가장자리가 축이라 아래로만 커져 그 면을 넘지 않는다. 창 높이가 대화 길이를
            따라 자라므로 띠도 창 바닥을 따라 내려간다. */}
        {band ? (
          <span
            aria-hidden
            className="absolute right-4 -bottom-6 z-10 min-[1400px]:supports-[anchor-name:--a]:hidden"
          >
            <Sticky
              key={band.join(" ")}
              tone={noteB ? "butter" : "pop"}
              size="sm"
              tilt={-2}
              className="tv-bump origin-top whitespace-nowrap"
            >
              {band.join(" ")}
            </Sticky>
          </span>
        ) : null}
        {/* 도장은 창 왼쪽 위 모서리에 — 머리의 ✦ · 닫기 아이콘에 닿지 않는다. 넓은 화면에서는 모서리
            밖으로 내밀고, 좁은 화면에서는 창이 거터(20)에 붙어 있어 밖으로 내밀면 화면 끝(x≈4)에 닿으므로
            모서리 안쪽(left-2)에 얹는다. 아래 끝이 창 위 8px 이라 머리 아이콘 줄까지 내려오지 않는다. */}
        <span aria-hidden className="absolute -top-4 left-2 z-10 lg:-left-4">
          <ExampleStamp />
        </span>

        <AppWindow
          as="figure"
          className="@container flex flex-col lg:max-h-[640px]"
        >
          <figcaption className="sr-only">
            예시 회의 「{TITLE}」를 범위로 내 에이전트에게 물어본 대화
          </figcaption>
          <RailHead className={HEAD_NARROW} />
          <ThreadTitle title="결제 화면 개편을 미룬 이유" />

          <div
            ref={convoRef}
            onScroll={onScroll}
            className="flex flex-col gap-4 px-5 pt-5 pb-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          >
            <UserBubble chip={chip}>{` ${SEED.q}`}</UserBubble>
            <div className="flex flex-col gap-1.5">
              <Answer>
                <Marked
                  text={SEED.a}
                  mark={SEED_MARK}
                  className={showA ? PEN : undefined}
                />
              </Answer>
              <div className="relative">
                <AnswerRefs
                  refs={SEED.refs}
                  open={open}
                  onOpenChange={setRefsOpen}
                  className="[anchor-name:--ask-refs]"
                />
                {cursor ? (
                  <Cursor
                    press
                    delay={50}
                    className="top-[25px] left-[106px]"
                  />
                ) : null}
              </div>
            </div>

            {view && q ? (
              <div key={view.n} className="flex flex-col gap-4">
                <UserBubble
                  chip={chip}
                  className={run ? "chat-rise" : undefined}
                >
                  {` ${q.ask.q}`}
                </UserBubble>
                {at === THINKING ? (
                  <p className="chat-shimmer m-0 text-xs">생각하는 중</p>
                ) : !done ? (
                  // 흐르는 글은 읽히지 않게 둔다 — 다 흐른 뒤의 답이 읽힌다. 앱 대화에는 커서가
                  // 없어서 끝에 깜박이는 막대를 달지 않는다.
                  <div aria-hidden>
                    <Answer>{full.slice(0, at)}</Answer>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <Answer>
                      <Marked
                        text={full}
                        mark={q.mark}
                        className={cn(PEN, "[anchor-name:--ask-mark]")}
                      />
                    </Answer>
                    <AnswerRefs
                      refs={q.ask.refs}
                      className={run ? "chat-rise" : undefined}
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* 선 대신 옅은 면 — 창 테두리와 두 겹이 되지 않게(머리 주석). */}
          <Composer
            chip={chip}
            busy={busy}
            className="mx-5 mb-4 border-transparent bg-[var(--el-canvas)]"
          />
        </AppWindow>

        {showA ? (
          <SideNote at="refs" tone="pop" tilt={3}>
            {NOTE_A}
          </SideNote>
        ) : null}
        {noteB ? (
          <SideNote
            key={noteB.join(" ")}
            at="mark"
            tone="butter"
            tilt={-3}
          >
            {noteB}
          </SideNote>
        ) : null}
      </div>

      <p role="status" className="sr-only">
        {said}
      </p>
    </div>
  );
}
