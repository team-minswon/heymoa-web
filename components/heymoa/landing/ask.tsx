import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import { AskChat } from "./ask-chat";
import { Hand, Scribble, Sticky } from "./marks";
import { CONTAINER, H2, LEAD, MARKER_REVEAL, SECTION_Y } from "./tokens";

/*
 * 내 에이전트 구간. tl;dv 에서 가져온 것 둘: 사람들이 회의실에서 늘 하는 말을 쪽지로 붙인 농담 띠
 * (「Take Jack's」 자리)와 장면별 질문 카드(「AI Prompt Examples」). 일부러 바꾼 것: 역할별 프롬프트
 * 대신 **장면별 질문**이고, 카드는 예시로 끝나지 않고 눌러서 아래 「내 에이전트」 창에 실제로 넣는다
 * (`ask-chat.tsx`). 답은 기존 랜딩 시연(`use-demo.ts`)의 것 그대로라 지어 쓴 답이 없다.
 *
 * 면은 라벤더 하나이고, 쪽지 · 형광펜 · 화살표는 페이지 목소리(`--tv-*`), 창 안은 앱 그대로다.
 *
 * 「물어보-」는 제목과 리드 두 번만 쓴다. 손글씨는 농담 띠를 받는 말(「이제 이건 에이전트한테」)이고
 * 질문 쪽지 라벨은 누르면 하는 일을 말한다(`ask-chat.tsx`) — 전에는 손글씨 「이런 건 이제 물어보면
 * 됩니다」와 라벨 「이런 것도 물어보세요」까지 한 화면에 네 번이라, 같은 틀의 문장이 기계적으로 읽혔다.
 *
 * 구간 이름은 h2(`ask-title`)다 — 회의 카드 · 근거 · 팀 구간과 같은 `aria-labelledby`. 명대사 벽과
 * 손글씨는 화면에서 제목 위에 서지만 **스크린 리더에는 숨긴다.** 벽은 두 열
 * 격자(제목 · 질문 | 창) 위를 가로지르는 따로 된 줄이라 DOM 에서도 제목보다 앞이고, 읽히게 두면 구간
 * 제목보다 농담 넷을 먼저 듣는다. 벽을 DOM 에서 제목 뒤로 옮기려면 제목을 두 열 격자에서 빼 배치를
 * 다시 짜야 해서 숨기는 쪽을 골랐다 — 무엇을 물을 수 있는지는 리드 문단과 질문 쪽지 셋이 같은 말을 한다.
 * 담당을 묻는 쪽지의 답은 회의 카드 · 근거 구간처럼 화자에 이름을 이어 준 뒤다 — `ask-chat.tsx` 참고.
 *
 * 리드 끝 문장은 「어디서 가져온 답인지 회의록을 눌러 확인」이다. 히어로 손글씨가 이미 「답 아래엔
 * 참고한 회의록이 붙어요」라고 해서, 전의 「답 아래 참고한 회의록이 붙어서…」는 같은 말을 두 번 했다.
 * 여기서는 붙는 자리 대신 눌러서 출처를 확인한다는 쪽만 말한다(앱 `AnswerRefs` 는 누르면 그 회의록을 연다).
 */

/** 회의실 명대사. 넓은 화면에서는 한 줄로 조금씩 들쭉날쭉하게, 좁은 화면에서는 2×2 로 선다. */
const WALL = [
  {
    text: "그거 누가 하기로 했죠?",
    tone: "pop",
    tilt: -4,
    big: true,
    shift: "lg:-translate-y-1",
  },
  {
    text: "지난주에 정한 거 아니었어요?",
    tone: "white",
    tilt: 3,
    big: false,
    shift: "lg:translate-y-3",
  },
  {
    text: "아까 뭐라고 했더라?",
    tone: "mint",
    tilt: -2,
    big: false,
    shift: "lg:-translate-y-2",
  },
  {
    text: "저 그때 없었는데요",
    tone: "butter",
    tilt: 4,
    big: true,
    shift: "lg:translate-y-2",
  },
] as const;

export function Ask() {
  return (
    <section
      id="ask"
      aria-labelledby="ask-title"
      className={`scroll-mt-20 bg-[var(--tv-lav)] ${SECTION_Y.color}`}
    >
      {/* 제목보다 앞에 서는 장식 줄이라 통째로 숨긴다(머리 주석). */}
      <Reveal aria-hidden className={CONTAINER}>
        <ul className="m-0 grid list-none grid-cols-2 items-center gap-x-3 gap-y-5 p-0 lg:flex lg:flex-wrap lg:justify-center lg:gap-x-6 lg:gap-y-4">
          {WALL.map((line, i) => (
            <li
              key={line.text}
              className={cn("flex justify-center", line.shift)}
            >
              <Sticky
                tone={line.tone}
                tilt={line.tilt}
                size="sm"
                anim="reveal"
                delay={i * 120}
                className={cn(
                  "text-[14px]",
                  line.big
                    ? "lg:px-4 lg:py-2.5 lg:text-[18px]"
                    : "lg:text-[15px]"
                )}
              >
                {line.text}
              </Sticky>
            </li>
          ))}
        </ul>
        {/* 넓은 화면에서는 아래 창 기둥(540)에 서서 창의 첫 질문 말풍선(오른쪽 정렬)을 가리킨다 —
            가운데에 두면 제목과 창 사이 빈 곳을 가리킨다. 그리드는 `ask-chat.tsx` 와 같은 열이다.
            오른쪽으로 48 비키는 것은 왼쪽 여백(pl-24 의 절반만큼 가운데가 옮겨진다)으로 한다 — 전에는 540
            기둥 상자째 `translate-x-12` 로 밀어서 1024 에서 상자가 화면 오른쪽 끝을 8px 넘었다. */}
        <div className="mt-7 flex justify-center lg:mt-9 lg:grid lg:grid-cols-[minmax(0,1fr)_540px] lg:gap-16">
          <div className="flex flex-col items-center gap-1 lg:col-start-2 lg:pl-24">
            <Hand className="text-[16px]">이제 이건 에이전트한테</Hand>
            <Scribble
              kind="arrow-down"
              draw="reveal"
              delay={600}
              className="lg:-rotate-[18deg]"
            />
          </div>
        </div>
      </Reveal>

      <AskChat
        heading={
          <Reveal>
            <h2 id="ask-title" className={H2}>
              물어보면 <span className="whitespace-nowrap">지난 회의에서</span>{" "}
              <span className={cn(MARKER_REVEAL, "whitespace-nowrap")}>
                찾아 줍니다
              </span>
            </h2>
            <p className={`${LEAD} mt-4`}>
              회의가 도는 중에도, 끝난 뒤에도 내 에이전트에게 물어보세요. 이
              회의부터 찾고, 모자라면 지난 회의까지 넓혀서 답합니다. 어디서
              가져온 답인지는 그 회의록을 눌러 바로 확인할 수 있습니다.
            </p>
          </Reveal>
        }
      />
    </section>
  );
}
