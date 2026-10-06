import type { ReactNode } from "react";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import {
  DecisionRow,
  FacePile,
  FacesChip,
  HeadChip,
  MiniBar,
  ReviewHead,
  SectionHead,
  TaskRow,
} from "./app";
import { ExampleStamp, Hand, Scribble, Sticky } from "./marks";
import {
  APP,
  CARD_TITLE,
  CONTAINER,
  FOCUS,
  H2,
  LEAD,
  MARKER_REVEAL,
  RADIUS,
  SECTION_Y,
  SHADOW,
  vars,
} from "./tokens";
import { CardRail, WeeklyWindow } from "./weekly-card";

/**
 * 회의 종류별 카드 세 장. tl;dv 의 「Action Items」 카드 줄(회의 종류마다 그 회의에서 나온 것)을
 * 번안했다.
 *
 * 카드 한 장 = **파스텔 머리(페이지의 목소리) + 흰 창 몸통(앱 요약 탭 조각)** 한 모양이다. 테두리 선
 * 없이 그림자 하나이고, 창을 또 다른 상자로 감싸지 않는다(머리 → 흰 몸통 → 둥근 근거 상자 → 그 안의 선처럼
 * 겹겹이 두르면 테두리가 여럿으로 읽힌다).
 * - 머리: 회의 종류 · 농담 한 줄 · 겹친 얼굴 · 그 회의에서 나온 한마디 · 「예시」 도장.
 *   장식은 둘뿐이다 — 제목 줄 오른쪽의 점선 도장, 얼굴 옆의 말풍선. 지난 판의 기울인 흰 테
 *   「결정 N · 할 일 N」 알약은 걷었다: 도장 바로 밑에 붙어 한 귀퉁이에 장식 넷(도장 · 알약 · 얼굴 ·
 *   말풍선)이 몰렸고, 쪽지 · 점선 도장 · 손글씨라는 장식 문법 밖의 넷째 모양이었고, 개수는 창 안 섹션
 *   머리(「결정 2」 「할 일 2」)가 이미 말한다.
 *   회의 종류 이름은 머리에만 두고, 창 안에는 앱처럼 프로젝트 칩만 둔다(창 안 흰 알약이 프로젝트처럼
 *   읽히는 혼선을 막는다).
 * - 몸통: 세 장 모두 요약 탭이라 화면 문법이 같다(검토 줄, 유형 이름 없음, 섹션 머리가 유형을 말함).
 *   카드마다 앱 기능 하나에 스포트라이트를 준다 — 킥오프 = 이름 붙이고 검토 완료까지 마친 「확정됨」,
 *   멘토링 = 담당 · 기한과 비어 있는 「기한 정하기」, 주간 회의 = 「이전 결정 대체 · 끝내기/유지」와
 *   확정 막대가 바뀌는 순간(`weekly-card.tsx`, 방문자가 직접 눌러도 된다). 「이전 결정 대체」는 앱
 *   SupersedeCard 구조 그대로다(옅은 면 상자 → 회색 트랙 → 「끝내기」 알약, 여백 · 색도 앱 값). 둥근 모양이
 *   셋 겹쳐 세 카드 중 가장 빽빽하지만 테두리 선은 알약 하나뿐이라 두 겹 테두리가 아니고, 앱 위젯이라
 *   여백 · 칠을 바꾸지 않는다.
 * - 카드 바닥에 선이 겹으로 서지 않게 한다: 각 카드 마지막 할 일 줄의 아래 선은 `.tv-row` 규칙(`motion.tsx`)이
 *   지우고(카드 바닥 18px 위에 남아 바닥이 두 겹으로 읽혔다), 주간 회의의 확정 막대는 카드 폭을 채우는 떠 있는
 *   막대 대신 가운데 좁은 알약 · 좁은 폭에서는 선 없는 판이다(`weekly-card.tsx` 머리 주석).
 * - 「철회됨」은 이 구간에서 쓰지 않는다. 회의 중 타임라인의 표시라 요약 탭에 그리면 화면 문법이 섞인다.
 * - 주석은 창 밖(파스텔 머리 · 카드 아래 모서리 · 넓은 화면의 카드 바깥 여백)에 둔다. 창 몸통 흐름 안에
 *   페이지 글자를 넣지 않는다 — 기울여도 검토 문서의 한 줄로 읽힌다. 창 위에 얹는 것(형광펜 · 동그라미 ·
 *   커서 · 앱이 비워 둔 자리의 쪽지)은 앱 글자 · 칩 · 버튼을 가리지 않는다. 점선 칩(「기한 정하기」)에는
 *   고리를 두르지 않는다 — 칩의 주황 점선 위에 보라 실선이 겹쳐 두 겹 테두리가 된다. 가리키는 것은 창 밖
 *   쪽지와 화살표가 맡는다(테두리 없는 「확정됨」 배지의 고리는 칠 면을 둘러 겹치지 않는다).
 * - 줄을 추린 것(요약 · 주제 · 「언제 정해졌나」 · 「＋ 추가」 · 요약/그래프 전환 생략)과 닫힌 줄의
 *   줄바꿈만 앱과 다르다. 섹션 사이 간격은 앱(44px)보다 좁다.
 *
 * tl;dv 에서 가져온 것: 파스텔 머리 카드 줄, 회의 종류별 농담, 기울어 엇갈린 줄. 바꾼 것: 플랫폼
 * 아이콘(Zoom · Meet)과 연동 앱 로고 자리는 HeyMoa 가 말하지 않는 것이라 비웠고, 그 자리를 앱 화면
 * 조각과 쪽지 · 손글씨 주석으로 채웠다. 좁은 화면에서는 세로로 쌓지 않고 가로로 넘긴다(구간 높이를
 * 카드 한 장 높이로 묶는다).
 *
 * 킥오프는 `landing/use-demo.ts` 의 3차 스프린트 킥오프(9월 1일 (화) 오후 2:00, 2분, 결정 둘 · 할 일 둘)
 * 그대로이고 화자 D 에 정우재라는 이름을 붙인 뒤의 모습이다. 멘토링 · 주간 회의와 그 인물은 지어냈다.
 */

const FACE_TONE = {
  lav: { bg: "bg-[var(--tv-lav)]", ring: "ring-[var(--tv-lav)]" },
  butter: { bg: "bg-[var(--tv-butter)]", ring: "ring-[var(--tv-butter)]" },
  mint: { bg: "bg-[var(--tv-mint)]", ring: "ring-[var(--tv-mint)]" },
} as const;

/**
 * 카드 틀. 머리(페이지) + 노트 상단바 축소판 + `children`(창 몸통과, 카드 기준으로 매달 주석).
 * 카드는 `overflow-hidden` 이 아니다 — 쪽지가 넓은 화면에서 카드 밖으로 걸쳐야 해서, 머리는 위 모서리를
 * 직접 둥글게 깎는다.
 */
function MeetingCard({
  tone,
  kind,
  joke,
  faces,
  line,
  lineWho,
  children,
}: {
  tone: keyof typeof FACE_TONE;
  kind: string;
  joke: string;
  /** 겹친 얼굴. 한마디를 한 사람을 맨 끝(말풍선 옆)에 둔다. */
  faces: string[];
  line: string;
  lineWho: string;
  children: ReactNode;
}) {
  return (
    <article className={cn("relative flex flex-col bg-white", RADIUS.card, SHADOW.panel)}>
      <header
        className={cn(
          "relative rounded-t-[24px] px-5 pt-5 pb-5 lg:rounded-t-[28px]",
          FACE_TONE[tone].bg
        )}
      >
        {/* 「예시」 도장은 제목 줄 오른쪽에 혼자 선다 — 머리 오른쪽 위에 다른 장식을 붙이지 않는다. */}
        <div className="flex items-start justify-between gap-3">
          <h3 className={CARD_TITLE}>{kind}</h3>
          <ExampleStamp className="mt-0.5" />
        </div>
        <Hand aria-hidden={false} className="relative mt-1 block w-fit text-[15px]">
          {joke}
          <Scribble
            kind="underline"
            draw="reveal"
            delay={250}
            className="absolute -bottom-2 left-0 h-2.5 w-full"
          />
        </Hand>
        <div className="mt-6 flex items-end gap-2">
          <FacePile names={faces} size={32} ring={FACE_TONE[tone].ring} />
          <p className="m-0 max-w-[200px] rounded-[16px] rounded-bl-[4px] bg-white px-3 py-1.5 text-[13.5px] leading-[1.4] font-bold break-keep text-[var(--tv-ink)]">
            <span className="sr-only">{lineWho}: </span>
            {line}
          </p>
        </div>
      </header>
      <MiniBar status="종료됨" tab="요약" />
      {children}
    </article>
  );
}

/**
 * 검토 문서 한 덩어리(`section-block.tsx` + `review-section.tsx`). 비었으면 앱의 빈 문구가 선다.
 * 빈 문구는 정보라 앱의 muted-soft(흰 바탕 2.5:1) 대신 한 단 짙은 muted(4.8:1)로 칠한다 — 랜딩에서는 읽혀야 한다.
 */
function DocSection({
  title,
  count,
  empty,
  className,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={className}>
      <SectionHead title={title} count={count} />
      {empty ? (
        <p className={cn("m-0 mt-2 border-t py-2.5 text-[13px]", APP.lineSoft, APP.muted)}>
          {empty}
        </p>
      ) : (
        <div className={cn("mt-2 border-t", APP.lineSoft)}>{children}</div>
      )}
    </div>
  );
}

const BODY_X = "px-4 sm:px-5";

function KickoffCard() {
  return (
    <MeetingCard
      tone="lav"
      kind="스프린트 킥오프"
      joke="방향 정하는 날"
      faces={["김민서", "이서연", "정우재", "박지훈"]}
      line="그 결정 그대로 갑니다."
      lineWho="박지훈"
    >
      <div className={cn("relative pt-4 pb-5", BODY_X)}>
        <ReviewHead
          state="확정됨"
          title="3차 스프린트 킥오프"
          chips={
            <>
              <HeadChip icon="date">9월 1일 (화) 오후 2:00</HeadChip>
              <HeadChip icon="length">2분</HeadChip>
              <FacesChip names={["김민서", "박지훈", "이서연", "정우재"]} />
              <HeadChip icon="project">온보딩 개선</HeadChip>
            </>
          }
        />
        {/* 「확정됨」 배지 둘레 동그라미 + 그 옆 빈 자리(앱의 요약/그래프 전환 자리)의 쪽지. */}
        <Scribble
          kind="circle"
          draw="reveal"
          delay={350}
          className="absolute top-[13px] left-[5px] h-[38px] w-[70px] sm:left-[9px]"
        />
        <Sticky
          tone="pop"
          size="sm"
          tilt={4}
          anim="reveal"
          delay={700}
          className="absolute top-[15px] left-[90px] sm:left-[94px]"
        >
          검토 완료 누른 뒤
        </Sticky>

        <DocSection title="결정" count={2} className="mt-6">
          <DecisionRow text="온보딩 이탈을 이번 스프린트의 첫 기준선으로 삼는다" at="00:00" />
          <DecisionRow text="결제 화면 개편은 다음 스프린트로 미룬다" at="00:14" />
        </DocSection>
        <DocSection title="할 일" count={2} className="mt-7">
          <TaskRow
            text="온보딩 이탈 로그 수집 초안을 올린다"
            who={{ name: "정우재" }}
            due="9월 3일 (목)"
            editable={false}
          />
          {/* 확정 뒤라 기한 칸이 비면 아무것도 서지 않는다(`due-cell.tsx` 비편집). */}
          <TaskRow
            text="로그 수집 작업을 Linear 이슈로 내보낸다"
            who={{ name: "박지훈" }}
            due={null}
            editable={false}
          />
        </DocSection>
      </div>
    </MeetingCard>
  );
}

function MentoringCard() {
  return (
    <MeetingCard
      tone="butter"
      kind="멘토링"
      joke="숙제 받는 날"
      faces={["오태윤", "한서진"]}
      line="답 안 단 거 세 개 남았어요."
      lineWho="한서진"
    >
      {/*
        아래 여백(pb-12)은 쪽지와 화살표가 「기한 정하기」를 가리킬 자리다. 점선 칩에는 고리를 두르지
        않는다(두 겹 테두리) — 화살표 끝도 칩 아래에서 멈춰 점선에 닿지 않는다.
        쪽지는 색 이름을 말하지 않는다. 지난 판 「비면 주황 점선!」은 히어로에서 막 배운 「주황 점선 = 답 못 한
        질문」(열린 질문 아이콘)과 엇갈렸다. 대신 왜 비었는지(회의에서 기한이 안 나왔다 — 킥오프의 박지훈 줄도
        같다)를 말한다. 「비어 있는 기한을 채운다」는 FAQ 가 이미 말해 되풀이하지 않는다. 둘째 줄은 「정하면 끝」
        대신 「정하면 돼요」다 — 검토 중인 문서라 검토 완료가 남았는데 「끝」은 다 끝난 것처럼 읽혔다.
        둘째 줄이 한 글자 길어져 쪽지 오른쪽 끝이 약 12px 늘어난 만큼 화살표도 12px 옮겨(96 → 108) 꼬리가
        쪽지 오른쪽 위 모서리에서 나오는 지난 판 모양을 지킨다. 머리는 여전히 「기한 정하기」 칩 아래에 멈춘다.
      */}
      <div className={cn("relative pt-4 pb-12", BODY_X)}>
        <ReviewHead
          state="검토 중"
          title="신입 개발자 멘토링"
          chips={
            <>
              <HeadChip icon="date">8월 28일 (금) 오후 4:00</HeadChip>
              <HeadChip icon="length">42분</HeadChip>
              <FacesChip names={["한서진", "오태윤"]} />
              <HeadChip icon="project">신입 온보딩</HeadChip>
            </>
          }
        />
        <DocSection title="결정" count={0} empty="정한 것이 없습니다." className="mt-6" />
        <DocSection title="할 일" count={3} className="mt-7">
          <TaskRow
            text="PR 설명을 세 줄 요약으로 바꾼다"
            who={{ name: "오태윤" }}
            due="9월 4일 (금)"
          />
          <TaskRow
            text="추천한 책 두 권의 링크를 보낸다"
            who={{ name: "한서진" }}
            due="8월 31일 (월)"
          />
          <TaskRow text="남은 리뷰 코멘트 세 개에 답을 단다" who={{ name: "오태윤" }} due={null} />
        </DocSection>
      </div>
      <Sticky
        tone="pop"
        size="sm"
        tilt={-3}
        anim="reveal"
        delay={800}
        className="absolute -bottom-6 left-3 z-10 lg:-left-2"
      >
        기한 안 나온 건
        <br />
        눌러서 정하면 돼요
      </Sticky>
      <Scribble
        kind="arrow"
        draw="reveal"
        delay={1000}
        className="absolute bottom-[22px] left-[108px] z-10 h-[38px] w-[60px]"
      />
    </MeetingCard>
  );
}

function WeeklyCard() {
  return (
    <MeetingCard
      tone="mint"
      kind="주간 회의"
      joke="말 바뀌는 날"
      faces={["윤하린", "송다온", "문지호"]}
      line="금요일은 QA 시간이 안 나와요."
      lineWho="문지호"
    >
      <WeeklyWindow />
    </MeetingCard>
  );
}

/**
 * 카드 한 칸. 좁은 화면에서는 가로 넘김 상자의 한 장(기울임 없음), 넓은 화면에서는 기울어 엇갈린
 * 격자 칸이다. 등장(`tv-r`)과 기울임(`tv-swing`)은 둘 다 `translate` 를 쓰므로 다른 요소에 둔다.
 *
 * 좁은 화면의 폭은 넘김 상자 안쪽 폭 − 16px 이다(= 화면 − 56px). 다음 카드는 24px 만 보인다 — 넘길 게
 * 있다는 신호로 충분하고, 그만큼 카드가 넓어 320 에서도 결정 줄이 두세 줄에 들어간다(84% 일 때는 235px
 * 이라 한두 낱말씩 다섯 줄로 꺾였다). 태블릿 폭에서는 360px 에 멈춘다.
 */
function Slot({
  i,
  tilt,
  drop,
  children,
}: {
  i: number;
  tilt: string;
  drop: string;
  children: ReactNode;
}) {
  return (
    <Reveal
      className={cn(
        "w-[calc(100%-16px)] max-w-[360px] shrink-0 snap-start lg:w-auto lg:max-w-none",
        drop
      )}
    >
      <div className="tv-r" style={vars({ "--i": i })}>
        <div className="tv-swing relative" style={vars({ "--tilt": tilt })}>
          {children}
        </div>
      </div>
    </Reveal>
  );
}

export function MeetingCards() {
  return (
    <section
      id="meetings"
      aria-labelledby="meetings-title"
      className={cn("scroll-mt-20 bg-white", SECTION_Y.white, "pb-2 lg:pb-24")}
    >
      <div className={CONTAINER}>
        <Reveal className="relative">
          <div className="tv-r">
            <h2 id="meetings-title" className={H2}>
              회의마다 남는 게 <span className={MARKER_REVEAL}>다릅니다</span>
            </h2>
            {/*
              리드는 카드가 말하지 않는 것만 — 지어낸 예시라는 것과, 주간 회의 카드는 눌린다는 것.
              회의별 성격은 카드 머리의 농담 · 한마디가, 「요약 탭」은 넓은 화면의 손글씨가 말한다.
            */}
            <p className={`${LEAD} mt-4 max-w-[640px]`}>
              아래 셋은 회의도 사람도 지어낸 예시입니다. 주간 회의 카드의 끝내기와 유지는 직접 눌러
              봐도 됩니다.
            </p>
            <div className="mt-5 flex justify-end lg:hidden">
              <Sticky tone="pop" size="sm" tilt={3}>
                옆으로 넘겨 보세요 →
              </Sticky>
            </div>
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute right-6 bottom-1 hidden items-end gap-1.5 lg:flex"
          >
            <Hand className="text-right text-[15px]">
              셋 다 회의 끝나고 보는
              <br />
              요약 탭이에요
            </Hand>
            <Scribble
              kind="arrow-down"
              draw="reveal"
              delay={800}
              className="h-[52px] w-7 translate-y-9"
            />
          </span>
        </Reveal>

        {/*
          좁은 화면: 화면 끝까지 닿는 가로 넘김 상자(-mx-5 로 기둥 여백을 상쇄). 포커스를 받으면 방향키로
          넘어간다. 아래 여백(pb-14)은 카드 밖으로 매달린 쪽지 · 손글씨 자리다 — 모자라면 상자가 세로로도
          스크롤된다. 넓은 화면: 세 칸 격자, 넘김 없음 — 그래서 `CardRail` 이 거기서는 포커스 정류장과
          region 을 거둔다.
        */}
        <CardRail
          label="회의 종류별 예시"
          className={cn(
            "-mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pt-3 pb-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "lg:mx-0 lg:mt-12 lg:grid lg:snap-none lg:grid-cols-3 lg:items-start lg:gap-6 lg:overflow-visible lg:px-0 lg:pt-0 lg:pb-0",
            FOCUS,
            "focus-visible:outline-offset-[-3px]"
          )}
        >
          <Slot i={0} tilt="-1.5deg" drop="lg:mt-0">
            <KickoffCard />
          </Slot>
          <Slot i={1} tilt="1deg" drop="lg:mt-10">
            <MentoringCard />
          </Slot>
          <Slot i={2} tilt="-0.6deg" drop="lg:mt-5">
            <WeeklyCard />
          </Slot>
        </CardRail>
      </div>
    </section>
  );
}
