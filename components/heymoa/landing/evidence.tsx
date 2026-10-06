import { Scissors } from "lucide-react";
import type { ReactNode } from "react";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import {
  AppWindow,
  ConfirmBar,
  DecisionRow,
  EvidenceQuotes,
  FacesChip,
  HeadChip,
  MiniBar,
  ReviewHead,
  RowActions,
  ScriptRow,
  SectionHead,
  TaskRow,
} from "./app";
import { Cursor, ExampleStamp, Hand, Scribble, Sticky, Tape } from "./marks";
import {
  CAPTION,
  CONTAINER,
  H2,
  LEAD,
  MARKER_REVEAL,
  SECTION_Y,
  SHADOW,
  vars,
} from "./tokens";

/**
 * 근거 구간 「그 말, 진짜 나왔어요?」. tl;dv 는 신뢰를 후기 모자이크와 보안 배지로 말하지만 HeyMoa 에는
 * 둘 다 없다. 그 자리를 **같은 회의의 창 두 장**으로 채운다 — 왼쪽은 스크립트 탭, 오른쪽은 요약 탭.
 * 수사극 농담으로 말 넷과 결정 · 할 일 넷에 노란 증거 번호표를 세우고, 스크립트의 그 마디에 앱의 근거
 * 형광펜(`--el-highlight`)을 칠해 짝을 짓는다. 창을 감싸는 바깥 카드는 두지 않는다.
 *
 * - 창 안은 앱 그대로다(`app.tsx`). 말은 `landing/use-demo.ts` 의 3차 스프린트 킥오프 발화 글자 그대로,
 *   결정 둘 · 할 일 둘 · 확정 막대 문구는 tldv-fidelity 브리프의 검증된 사실 그대로다. 창 안은 행만
 *   추렸다 — 스크립트는 결정 · 할 일이 된 네 마디(00:00 · 00:14 · 01:02 · 01:19)만 남기고 00:31 ·
 *   00:44 · 01:33 · 01:48 을 뺐고, 요약의 「언제 정해졌나」 · 요약 · 주제도 뺐다. 그 자리에 아무것도
 *   그리지 않는다(앱의 공백 줄 `transcript-gap-row.tsx` 와 닮은 선이 「앱이 줄여 보여 준다」로 읽히지
 *   않게). 추렸다는 말은 창 아래 가장자리에 반쯤 걸친 기운 종이 띠(`Tape`)가 **남긴 것**으로 한다 —
 *   뺀 시각을 나열하면 하나만 빠뜨려도 틀린 고지가 된다(r1 의 「00:31·00:44 두 마디」가 그랬다).
 * - 시점: 회의 카드 첫 장(`meeting-cards.tsx`)이 같은 회의를 「확정됨」 + 쪽지 「검토 완료 누른 뒤」로
 *   먼저 보여 준다. 여기는 그 전 장면이라 요약 창의 「검토 중」 배지에 같은 자리 · 같은 모양의 동그라미와
 *   쪽지 「검토 완료 누르기 전」을 단다(전과 후가 짝으로 읽히게). 이 그림의 쪽지는 이것과 「눌러야
 *   확정」 둘이고, 확인창 설명은 손글씨다.
 * - 말 나눔: 리드는 「펼치면 그 말이 나온 스크립트가 붙어 있다 → 고치거나 뺀다」까지만 말한다(한 문단).
 *   「검토 완료를 눌러야 프로젝트에 올라간다」는 리드에서 뺐다 — r4 는 리드 둘째 문단 · 배지 쪽지 「검토 완료
 *   누르기 전」 · 버튼 쪽지 「눌러야 확정」이 한 구간에서 세 번 말했고, 히어로 쪽지 · FAQ 02 까지 페이지에서
 *   다섯 번이었다. 창 안 막대(「결정 2개와 할 일 2개를 프로젝트에 올립니다 | 검토 완료」)와 그 버튼을 가리키는
 *   「눌러야 확정」이 그림으로 말한다. 「몇 분에 누가 한 말인지」는 히어로 리드(「누가 한 말인지도 갈라 둡니다」)가
 *   이미 해서 뺐다. 펼친 근거 옆 손글씨는 리드가 말하지 않는 것만 짚는다 — 근거 상자가 두 줄인 까닭(진한 줄이
 *   그 말, 흐린 줄은 바로 앞 말 = 앱 `moments.ts` `quotesOf` 의 맥락 줄). 확인창과 「완료하면 못 고친다」는
 *   버튼 밑 손글씨 한 곳에서만 말한다. 그 손글씨는 히어로 ② 쪽지(「누르면 한 번 더 물어봐요」, 회의 종료)와
 *   같은 틀로 들리지 않게 「확인창부터 떠요」로 쓴다. 손글씨 · 쪽지는 화면 읽기에서 빠지므로 그 말은 그림
 *   설명(`sr-only`)에 한 번 둔다.
 * - 확정 막대: 직전 판은 막대가 창 안 바닥 20px 위에 서서 둥근 선이 창 테두리와 나란히 한 겹 더 생겼다(390 은
 *   네 변, 1440 은 바닥). 그래서 막대를 창 밖 형제로 빼고 창 바닥선에 반쯤 걸친다(`-mt-6`, 막대 높이의 절반). 창과
 *   막대를 한 칸(`tv-swing`)에 묶어 같이 기운다. 모양은 폭 구간을 겹치지 않게 셋으로 가른다(히어로와 같은 360
 *   경계): xl(창 490)은 앱 그대로의 `float`(양옆 여백 약 48px), 360~1279 는 `pill`, 360 미만은 창 안 바닥의
 *   `plate`. 1024 의 창 440 에 `float`(393)를 걸치면 양옆이 23px 라 다시 테두리처럼 읽히고, 390 에서는 `float`
 *   가 두 줄로 꺾여 창 폭을 다 채운다. 알약(최대 264)은 360 에서 창(320) 양옆 28px 안쪽이지만, r4 는 360 미만도
 *   알약이라 320 에서 막대 28..292 · 창 20..300(8px), 340 에서 18px 로 같은 폭의 둥근 상자 두 겹이었다. 그래서
 *   360 미만은 걸친 칸을 숨기고 선 · 그림자 없는 회색 판을 창 본문 끝에 둔다(판은 면이라 창 안에서도 겹이 아니다,
 *   문구 두 줄 + 「검토 완료」는 다음 줄 오른쪽). 창 본문은 걸친 막대가 덮는 절반 + 숨 한 칸만큼 아래를 비우고
 *   (`pb-10`), 360 미만은 `pb-5` 다. 마지막 할 일 줄 · 스크립트 마지막 마디의 아래 선은 `.tv-row` 규칙
 *   (`motion.tsx`)이 지운다 — 프레임 바닥 바로 위에 선이 남지 않는다.
 * - 짝 그림(번호표 · 형광펜 짝 · 사이 화살표)은 이 페이지만의 과장이다. 앱에서 근거가 실제로 서는 모습은
 *   요약 창의 펼친 결정 줄이 보인다 — 줄을 펼치면 그 아래 근거 발언 상자(맥락 줄 회색, 인용 줄 먹색).
 * - 쪽지 둘은 「검토 완료」 버튼 자리에 매달아 화면 폭 · 막대 모양이 바뀌어도 버튼을 가리킨다. 확인창 문구의 근거는
 *   `confirm-bar.tsx`(「완료한 뒤에는 검토를 고칠 수 없습니다」). 넓은 화면에서는 확인창 손글씨를 쪽지
 *   왼쪽 같은 줄에 앉혀 창 밑으로 늘어지는 길이를 줄인다(좁은 화면은 쪽지 아래).
 * - 배치(r3): 넓은 화면은 두 단이다 — 왼쪽 = 제목 · 리드 · 스크립트 창 · 캡션, 오른쪽 = 요약 창(위를 제목
 *   위에 맞춤). r2 는 제목 · 리드가 두 창 위를 가로질러서 왼쪽 창이 요약 창보다 600px 쯤 먼저 끝났고(빈
 *   버터 면, 구간 1696px), 증거 3 · 4 는 위아래로 멀었다. 지금은 요약 창이 제목 높이에서 시작하고 스크립트
 *   창이 리드 아래에서 시작한다. 리드가 한 문단이 된 뒤(r5) 스크립트 첫 마디는 1024~1440 모두 요약의 첫
 *   결정보다 24px 아래에서 시작하고(DOM 시뮬레이션), 그 높이 차를 아래 손글씨가 잇는다. 왼쪽 단이 요약 창보다 먼저 끝나지만 그 아래 오른쪽은
 *   버튼에 매단 쪽지 · 손글씨 자리라 빈 면이 길지 않다. 그래서 sticky 는 걷었다.
 * - 「이 말이 → 이 결정」 손글씨는 두 창 사이 틈(96px)에 서고, 스크립트 첫 마디(00:00 김민서, 증거 1) 옆에서
 *   요약의 첫 결정(00:00, 증거 1) 줄로 올라간다 — 번호표가 말하는 짝 그대로다. r3 은 이 손글씨를 스크립트
 *   창에 매달아서 리드 높이만큼 내려앉았고, 화살 끝이 둘째 결정(증거 2)에 닿아 짝이 틀리게 읽혔다. 그래서
 *   가리키는 쪽(화살 끝 · 「이 결정」)을 요약 창 첫 결정 줄에 매단다. 리드가 몇 줄이 되든 끝은 그 줄을 떠나지
 *   않고, 「이 말이」는 1024~1440 에서 스크립트 첫 마디(그 말 본문 둘째 줄) 높이에 온다 — 리드가 세 줄로
 *   고르게 꺾여 폭에 따라 어긋나지 않는다. 번호표는 바깥 가장자리에 둔다 — 틈 양쪽에 번호표를 마주 세우면 손글씨가 설 자리가
 *   없고, 기운 두 창이 아래쪽에서 서로 다가와 번호표끼리 닿는다.
 * - 펼친 결정은 검증된 근거가 있는 둘째 결정이고, 근거 상자는 앱(`moments.ts` `quotesOf`)처럼 인용 줄 +
 *   바로 앞 맥락 줄 둘이다. 높이를 줄이려 맥락 줄을 빼면 앱의 근거 상자 모양이 달라져 남겼다. 그 아래
 *   「수정 · 제외」는 앱(`review-row.tsx` 펼친 칸 `space-y-2.5`)처럼 상자와 10px 띄운다 — r3 은 근거 상자의
 *   `m-0` 이 부모 간격을 지워 상자 바닥선에 붙어 상자 일부처럼 보였다. 들여쓰기는 앱처럼 상자 왼쪽선이고,
 *   sm 부터는 오른쪽도 16px 들인다(`sm:mr-4`) — r4 는 상자 오른쪽이 창 가장자리 21px(768 은 20px) 안쪽에
 *   170px 나란히 서서 동심 두 겹이었다. 지금은 36px 넘게 떨어진다(sm 미만은 상자 대신 왼쪽 세로선이라 해당 없음).
 * - 「예시」 도장은 그림마다 하나, 먼저 보이는 창에 단다 — 넓은 화면은 요약 창(제목 옆), 좁은 화면은
 *   스크립트 창. 이름 캡션은 이름이 보이는 첫 창(스크립트) 바로 아래에 한 벌만 둔다(좁은 화면에서 구간 맨
 *   아래로 떨어지던 것을 바로잡았다).
 * - 스크롤 등장은 머리 · 스크립트 · 요약이 따로다. 좁은 화면에서 두 창이 1000px 넘게 떨어져 있어, 한
 *   `Reveal` 로 묶으면 요약의 번호표가 화면 밖에서 다 튀고 끝났다.
 * - 서버 컴포넌트. 움직임은 `Reveal` 이 켜는 `tv-r*` 클래스뿐이고, 모션을 줄이면 처음부터 다 칠해져 있다.
 */

type Line = {
  at: string;
  who: string;
  before: string;
  mark: string;
  after: string;
};

/** 스크립트에 남긴 네 마디. `mark` 가 결정 · 할 일이 된 부분이다. */
const LINES: Line[] = [
  {
    at: "00:00",
    who: "김민서",
    before: "이번 스프린트는 ",
    mark: "온보딩 이탈부터 봅니다",
    after: ". 지난주에 남긴 가설 두 개를 먼저 정리하죠.",
  },
  {
    at: "00:14",
    who: "박지훈",
    before: "지난 회의에서 ",
    mark: "결제 화면 개편은 다음으로 미뤘습니다",
    after: ". 그 결정 그대로 갑니다.",
  },
  {
    at: "01:02",
    who: "정우재",
    before: "그럼 온보딩 이탈 로그 수집은 제가 맡겠습니다. ",
    mark: "이번 주 목요일까지 초안 올릴게요",
    after: ".",
  },
  {
    at: "01:19",
    who: "박지훈",
    before: "좋습니다. 그 작업은 ",
    mark: "Linear 이슈로 바로 내보내는",
    after: " 게 좋겠어요.",
  },
];

/** 짝 k(0부터)가 칠해지는 때. 형광펜 → 스크립트 번호표 → 요약 번호표 순으로 80ms 씩 뒤따른다. */
const pairAt = (k: number) => 700 + k * 260;

/**
 * 앱의 근거 형광펜(`globals.css` `.evidence-mark` — `--el-highlight` 를 글자 아래 0.66em). 앱은 근거로
 * 뛰어갈 때 잠깐 칠하고 지우지만 여기서는 짝을 보이려고 남겨 둔다(창 위 강조). `tv-rmark` 가 칠한다.
 */
function Pen({ d, children }: { d: number; children: ReactNode }) {
  return (
    <span
      className="tv-rmark bg-[linear-gradient(var(--el-highlight),var(--el-highlight))] bg-no-repeat [background-position:0_100%] [background-size:100%_0.66em] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]"
      style={vars({ "--d": `${d}ms` })}
    >
      {children}
    </span>
  );
}

/**
 * 증거 번호표 — 창 가장자리에 반 넘게 걸친 노란 표(창 위 주석). 좁은 화면은 숫자만 든 동그라미가
 * 창 테두리에 걸치고, 넓은 화면은 「증거 N」 텐트가 창 밖으로 나간다. 어느 쪽이든 창 글자를 덮지 않고
 * 창 본문 여백(20px)까지만 들어온다. 놓인 줄(`relative`)의 바깥 가장자리에 붙는다.
 */
function Tag({
  n,
  side,
  row,
  d,
}: {
  n: number;
  side: "left" | "right";
  /** script = 스크립트 줄(시각 높이), review = 검토 줄(첫 줄 높이) */
  row: "script" | "review";
  d: number;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "tv-rpop pointer-events-none absolute z-10 flex flex-col items-center",
        side === "left"
          ? "right-[calc(100%_+_9px)] lg:right-[calc(100%_+_6px)]"
          : "left-[calc(100%_+_9px)] lg:left-[calc(100%_+_6px)]",
        row === "script" ? "top-[15px] lg:top-3" : "top-3 lg:top-[9px]"
      )}
      style={vars({ "--d": `${d}ms` })}
    >
      <span
        className={cn(
          "flex size-[22px] items-center justify-center rounded-full bg-[var(--tv-pop)] text-[11.5px] font-extrabold tabular-nums text-[var(--tv-ink)] lg:h-7 lg:w-auto lg:rounded-[6px] lg:px-2 lg:text-[12px]",
          SHADOW.sticky
        )}
      >
        <span className="hidden whitespace-pre lg:inline">증거 </span>
        {n}
      </span>
      <span className="hidden size-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-[var(--tv-pop)] lg:block" />
    </span>
  );
}

function ScriptWindow() {
  return (
    <AppWindow
      className="tv-swing overflow-visible"
      style={vars({ "--tilt": "-1.5deg" })}
    >
      <MiniBar
        status="종료됨"
        tab="스크립트"
        size="md"
        title={<span className="hidden sm:inline">3차 스프린트 킥오프</span>}
      />
      <ol className="m-0 list-none px-5 pb-3 lg:[zoom:1.04]">
        {LINES.map((line, k) => (
          <ScriptLi key={line.at} line={line} k={k} />
        ))}
      </ol>
      {/* 추린 마디 — 창 아래 가장자리에 걸친 기운 종이 띠(창 위 주석). 창 안으로는 본문 아래 여백
          (pb-3) 몇 px 까지만 들어와 마지막 줄의 선과 글자를 덮지 않고, 창과 같이 기운다. 실제 글자다.
          뺀 시각 대신 남긴 것을 말한다(머리 주석). */}
      <Tape className="absolute right-3 -bottom-6 h-7 gap-1.5 text-[12px] sm:right-5 sm:text-[13px]">
        <Scissors aria-hidden className="size-3.5 shrink-0" />
        결정·할 일이 된 네 마디만 남겼어요
      </Tape>
    </AppWindow>
  );
}

function ScriptLi({ line, k }: { line: Line; k: number }) {
  return (
    <li className="relative">
      <ScriptRow
        at={line.at}
        speaker={{ name: line.who }}
        className="grid-cols-[40px_minmax(0,1fr)] gap-3 py-3.5 sm:grid-cols-[52px_minmax(0,1fr)] sm:gap-4"
      >
        {line.before}
        <Pen d={pairAt(k)}>{line.mark}</Pen>
        {line.after}
      </ScriptRow>
      <Tag n={k + 1} side="left" row="script" d={pairAt(k) + 80} />
    </li>
  );
}

/** 「검토 완료」 버튼 안에 매다는 주석 — 커서(올려만 둔다) · 위로 화살표 · 쪽지 둘. 버튼을 따라 움직인다. */
function ButtonNotes() {
  return (
    <>
      <span
        aria-hidden
        className="tv-rslide pointer-events-none absolute inset-0"
        style={vars({ "--d": "1900ms" })}
      >
        {/* 화살 끝이 글자 오른쪽 아래 모서리에 오게 — 「검토 완료」 글자를 덮지 않는다. */}
        <Cursor className="top-[68%] left-[76%]" />
      </span>
      <Scribble
        kind="arrow-down"
        rotate={180}
        draw="reveal"
        delay={1700}
        className="absolute top-[calc(100%_+_6px)] left-1/2 -translate-x-1/2"
      />
      <Sticky
        tone="pop"
        size="lg"
        tilt={-4}
        anim="reveal"
        delay={1850}
        className="absolute top-[calc(100%_+_62px)] left-1/2 -translate-x-1/2 whitespace-nowrap"
      >
        눌러야 확정
      </Sticky>
      {/* 확인창 설명은 손글씨(쪽지는 위 「검토 완료 누르기 전」과 「눌러야 확정」 둘까지). */}
      {/* 좁은 화면 = 쪽지 아래, 넓은 화면 = 쪽지 왼쪽 같은 줄(쪽지 반폭 ≈ 61px + 틈). */}
      <span
        className="tv-rpop absolute top-[calc(100%_+_118px)] right-[calc(100%_-_24px)] lg:top-[calc(100%_+_68px)] lg:right-[calc(50%_+_72px)]"
        style={vars({ "--d": "2050ms" })}
      >
        <Hand className="whitespace-nowrap">
          실수로 눌러도 확인창부터 떠요
          <br />
          완료하면 못 고쳐요
        </Hand>
      </span>
    </>
  );
}

/**
 * 「이 말이 → 이 결정」 — 넓은 화면에서 두 창 사이 틈(96px)에 서는 손글씨.
 * 아래 「이 말이」(스크립트 첫 마디 · 증거 1 옆)에서 위 「이 결정」(요약 첫 결정 · 증거 1 옆)으로 화살이
 * 올라간다. 요약 창 첫 결정 줄(`relative`)에 매달아 「이 결정」 가운데가 그 줄 가운데에 온다(라벨 높이
 * 19px 의 반). 오른쪽 끝은 창 본문 여백(px-5)을 넘어 창 왼쪽 선 6px 바깥이다. 번호표는 두 창 바깥
 * 가장자리에 있어 틈에는 이것만 선다.
 */
function PairNote() {
  return (
    <span
      aria-hidden
      className="tv-rpop pointer-events-none absolute top-[calc(50%_-_10px)] right-[calc(100%_+_26px)] hidden h-20 w-[84px] lg:block"
      style={vars({ "--d": "450ms" })}
    >
      <Hand className="absolute top-0 right-0 whitespace-nowrap">이 결정</Hand>
      <Scribble
        kind="arrow"
        draw="reveal"
        delay={550}
        className="absolute top-[14px] left-[14px] h-10 w-[60px]"
      />
      <Hand className="absolute bottom-0 left-0 whitespace-nowrap">
        이 말이
      </Hand>
    </span>
  );
}

function SummaryWindow() {
  const quoted = LINES[1];
  return (
    // 창과 확정 막대를 한 칸에 묶어 같이 기운다 — 막대가 창 바닥선에 걸친 채로(머리 주석 「확정 막대」).
    <div className="tv-swing" style={vars({ "--tilt": "1deg" })}>
      <AppWindow className="overflow-visible">
        <MiniBar
          status="종료됨"
          tab="요약"
          size="md"
          title={<span className="hidden sm:inline">3차 스프린트 킥오프</span>}
        />
        {/* pb-10 = 아래에서 걸쳐 들어오는 막대 절반(24px) + 숨 한 칸. 360 미만은 막대가 창 안 판이라 pb-5. */}
        <div className="relative px-5 pt-5 pb-10 max-[360px]:pb-5 lg:[zoom:1.04]">
          {/* 검토 문서 머리. 요약 · 그래프 토글과 프로젝트 칩, 머리와 「결정」 사이의 「언제 정해졌나」 ·
            요약 · 주제는 덜었다(줄이기만 했다). 섹션 사이 간격은 앱의 pt-7 그대로. */}
          {/* 시점 — 회의 카드 첫 장의 「확정됨」 동그라미 + 「검토 완료 누른 뒤」와 같은 자리 · 같은 모양.
            배지 줄(min-h-8) 가운데 = pt-5 + 16px. 쪽지는 배지 오른쪽 빈자리(앱의 요약/그래프 전환
            자리)에 앉아 제목(배지 줄 + mt-2.5 아래)에 닿지 않는다. */}
          <Scribble
            kind="circle"
            draw="reveal"
            delay={300}
            className="absolute top-[17px] left-[8px] h-[38px] w-[74px]"
          />
          <Sticky
            tone="pop"
            size="sm"
            tilt={4}
            anim="reveal"
            delay={600}
            className="absolute top-[19px] left-[98px] whitespace-nowrap"
          >
            검토 완료 누르기 전
          </Sticky>
          <ReviewHead
            state="검토 중"
            title="3차 스프린트 킥오프"
            chips={
              <>
                <HeadChip icon="date">9월 1일 (화) 오후 2:00</HeadChip>
                <HeadChip icon="length">2분</HeadChip>
                <FacesChip names={["김민서", "박지훈", "이서연", "정우재"]} />
              </>
            }
          />
          <SectionHead title="결정" count={2} className="mt-7" />
          <div className="mt-2">
            <div className="relative">
              <DecisionRow
                text="온보딩 이탈을 이번 스프린트의 첫 기준선으로 삼는다"
                topic="스프린트 우선순위"
                at="00:00"
              />
              <Tag n={1} side="right" row="review" d={pairAt(0) + 160} />
              <PairNote />
            </div>
            <div className="relative">
              <DecisionRow
                text="결제 화면 개편은 다음 스프린트로 미룬다"
                topic="스프린트 우선순위"
                at="00:14"
                open
              >
                {/* sm:mr-4 — 창 가장자리와 나란한 두 겹을 피한다(머리 주석 「펼친 결정」). */}
                <EvidenceQuotes
                  className="sm:mr-4"
                  quotes={[
                    {
                      who: LINES[0].who,
                      at: LINES[0].at,
                      text: `${LINES[0].before}${LINES[0].mark}${LINES[0].after}`,
                      cited: false,
                    },
                    {
                      who: quoted.who,
                      at: quoted.at,
                      text: (
                        <>
                          {quoted.before}
                          <Pen d={pairAt(1) + 160}>{quoted.mark}</Pen>
                          {quoted.after}
                        </>
                      ),
                      cited: true,
                    },
                  ]}
                />
                {/* 앱 간격(펼친 칸 space-y-2.5)을 근거 상자의 m-0 이 지우므로 여기서 다시 띄운다(머리 주석). */}
                <div className="mt-2.5">
                  <RowActions />
                </div>
              </DecisionRow>
              <Tag n={2} side="right" row="review" d={pairAt(1) + 160} />
              {/* 펼친 근거 상자를 창 밖에서 가리키는 손글씨. 창 오른쪽 바깥에 130px 이 남는 1340 부터. */}
              <span
                aria-hidden
                className="tv-rpop pointer-events-none absolute top-[104px] left-[calc(100%_+_6px)] hidden flex-col items-start min-[1340px]:flex"
                style={vars({ "--d": "1300ms" })}
              >
                <Scribble
                  kind="arrow"
                  flipX
                  rotate={-30}
                  draw="reveal"
                  delay={1350}
                />
                {/* 리드가 말하지 않는 것 — 근거 상자가 두 줄인 까닭(머리 주석 「말 나눔」). 줄마다 100px
                  안쪽이라 1340 에서 창 오른쪽 바깥 자리(약 140px) 안에 든다. */}
                <Hand className="mt-1 ml-5 whitespace-nowrap">
                  진한 줄이 그 말,
                  <br />
                  흐린 줄은 바로
                  <br />
                  앞에 나온 말
                </Hand>
              </span>
            </div>
          </div>

          <SectionHead title="할 일" count={2} className="mt-8" />
          <div className="mt-2">
            <div className="relative">
              <TaskRow
                text="온보딩 이탈 로그 수집 초안을 올린다"
                who={{ name: "정우재" }}
                due="9월 3일 (목)"
              />
              <Tag n={3} side="right" row="review" d={pairAt(2) + 160} />
            </div>
            <div className="relative">
              <TaskRow
                text="로그 수집 작업을 Linear 이슈로 내보낸다"
                who={{ name: "박지훈" }}
                due={null}
              />
              <Tag n={4} side="right" row="review" d={pairAt(3) + 160} />
            </div>
          </div>
          {/* 360 미만 — 선 없는 판을 창 안 바닥에 둔다(히어로와 같은 경계, 머리 주석 「확정 막대」). */}
          <ConfirmBar
            variant="plate"
            state={{ kind: "ready", decisions: 2, tasks: 2 }}
            buttonSlot={<ButtonNotes />}
            className="mt-6 min-[360px]:hidden"
          />
        </div>
      </AppWindow>
      {/* 확정 막대 — 창 밖 형제로 창 바닥선에 반쯤 걸친다. 폭 구간은 겹치지 않는다: 360 미만 = 위의 창 안
        판(이 칸은 숨는다), 360~1279 = 알약, xl = 앱 그대로의 float(머리 주석). 셋 중 하나만 보이므로 버튼에
        매단 쪽지도 보이는 쪽 하나만 선다. */}
      <div className="relative -mt-6 flex justify-center max-[360px]:hidden">
        <ConfirmBar
          variant="pill"
          state={{ kind: "ready", decisions: 2, tasks: 2 }}
          buttonSlot={<ButtonNotes />}
          className="xl:hidden"
        />
        <ConfirmBar
          variant="float"
          state={{ kind: "ready", decisions: 2, tasks: 2 }}
          buttonSlot={<ButtonNotes />}
          className="hidden xl:flex"
        />
      </div>
    </div>
  );
}

export function Evidence() {
  return (
    <section
      id="evidence"
      aria-labelledby="evidence-title"
      className={`scroll-mt-20 bg-[var(--tv-butter)] ${SECTION_Y.color}`}
    >
      <div
        className={cn(
          CONTAINER,
          "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-start lg:gap-x-24"
        )}
      >
        {/* 왼쪽 단 — 제목 · 리드 · 스크립트 창 · 캡션 */}
        <div>
          <Reveal className="grid gap-5 lg:gap-6">
            <h2 id="evidence-title" className={`tv-r ${H2}`}>
              그 말,{" "}
              <span className={MARKER_REVEAL} style={vars({ "--d": "350ms" })}>
                진짜
              </span>{" "}
              나왔어요?
            </h2>
            <div className="tv-r" style={vars({ "--i": 1 })}>
              {/* 「몇 분에 누가」는 히어로 리드가 했다 — 여기는 「정말 그렇게 말했나」를 대 보는 자리. */}
              <p className={LEAD}>
                결정이든 할 일이든 펼치면 그 말이 나온 스크립트가 그대로 붙어
                있습니다. 정말 그렇게 말했는지는 거기서 보면 됩니다. 잘못
                잡혔으면 줄마다 고치거나 빼고요.
              </p>
              {/* 「검토 완료를 눌러야 올라간다」는 리드에서 말하지 않는다 — 창 안 막대 · 쪽지가 한다(머리 주석 「말 나눔」). */}
            </div>
          </Reveal>

          <Reveal className="mt-12 lg:mt-16">
            <p className="sr-only">
              아래는 같은 회의의 스크립트 탭과 요약 탭입니다. 스크립트의 네
              마디가 요약의 결정 둘과 할 일 둘이 되었습니다. 요약 탭은 검토
              완료를 누르기 전 모습입니다. 검토 완료를 누르면 확인창이 먼저
              뜨고, 완료한 검토는 고칠 수 없습니다.
            </p>
            <div className="tv-r relative">
              <ExampleStamp className="absolute -top-3 -left-2 z-20 lg:hidden" />
              <ScriptWindow />
              {/* 이름이 보이는 첫 창 바로 아래. 창 밑으로 반쯤 나온 종이 띠를 비켜 mt-11. */}
              <p className={cn(CAPTION, "mt-11 flex items-start gap-2")}>
                <Scribble
                  kind="arrow"
                  rotate={-50}
                  className="mt-0.5 h-7 w-10"
                />
                그림 속 이름은 화자에 직접 이름을 붙인 뒤의 모습입니다. 붙이기
                전에는 「화자 A」처럼 나옵니다.
              </p>
            </div>
          </Reveal>
        </div>

        {/* 오른쪽 단 — 요약 창. 위가 제목 위와 맞는다. */}
        <Reveal className="mt-6 lg:mt-0">
          {/* 좁은 화면 — 두 창 사이 */}
          <div
            aria-hidden
            className="flex items-center justify-center gap-2 pb-4 lg:hidden"
          >
            <Scribble kind="arrow-down" draw="reveal" delay={500} />
            <Hand>같은 번호끼리 짝이에요</Hand>
          </div>
          <div className="tv-r relative" style={vars({ "--i": 2 })}>
            <ExampleStamp className="absolute -top-4 -left-4 z-20 hidden lg:inline-flex" />
            <SummaryWindow />
            {/* 버튼에 매단 쪽지 · 손글씨가 막대 밑으로 내려오는 자리. 버튼 바닥이 막대 바닥보다 7px 위이고,
                좁으면 손글씨가 쪽지 아래(버튼 밑 +156), 넓으면 쪽지 옆(+110)까지 내려온다. 360 미만은 버튼이
                창 바닥 27px 위(판 안)라 창 바닥에서 +129 까지다. */}
            <div
              aria-hidden
              className="h-[168px] max-[360px]:h-[148px] lg:h-[112px]"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
