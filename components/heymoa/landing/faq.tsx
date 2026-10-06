import type { ReactNode } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import {
  AgendaHead,
  AppWindow,
  DecisionRow,
  MiniBar,
  RowActions,
  SectionHead,
  TimelineList,
  TimelineRow,
} from "./app";
import { ExampleStamp, Scribble, Speech } from "./marks";
import { APP, BODY, CONTAINER, FOCUS, H2, HAND, MARKER, SECTION_Y, SHADOW, vars } from "./tokens";

/**
 * 자주 묻는 것. tl;dv 의 접이식 FAQ 를 가져왔고, 이 구간의 장치는 **큰 번호 + 작은 앱 조각**이다.
 *
 * - 번호는 30/38px 굵은 고딕에 버터색 형광펜 띠를 깐다. 펼치거나 올리면 띠가 노랑(`--tv-pop`)으로
 *   바뀌고(오른쪽 원 화살표와 같은 규칙), 구간이 화면에 들어오면 띠가 위에서부터 차례로 칠해진다.
 * - 모두 닫힌 채 시작한다 — 01 · 03 을 펼쳐 두었더니 긴 답과 앱 조각이 목록을 덮어 질문들이 한눈에 안 보였다.
 *   `name` 으로 하나만 열리게 묶지 않았다(여럿을 같이 펼쳐 볼 수 있게).
 * - 앱 조각은 둘이고 화면이 다르다: 03 = 회의 중 타임라인(「철회됨」), 04 = 요약 탭의 검토 줄(제외 →
 *   그어진 채 남고 「제외 취소」). 둘 다 회의실 예약 이야기라 「예시」 도장을 붙였다.
 * - 왼쪽 기둥(넓은 화면, sticky)은 노란 「?」 쪽지 + 목록 쪽 화살표 + 두 사람의 농담(「저 이번 주
 *   당번인데요…」 → 「06번 보세요」)으로 채운다. 말풍선은 06 질문을 되풀이하지 않고 상황만 던진다.
 *   좁은 화면은 제목 옆 작은 「?」와 같은 농담만. 농담은 당번 이야기다 — 어디서 쓰는지(웹 · 데스크톱)는
 *   01 답에만 둔다(`top-bar.tsx`). 390 에서는 이 농담이 질문 목록보다 먼저 보여서 여기에 그 말이 있으면
 *   01 밖으로 새어 나간 것처럼 읽혔다.
 * - 접고 펴는 것은 네이티브 `<details>` 라 클라이언트 코드가 없다(부드럽게 열리는 것은 지원하는
 *   브라우저에서만 — `motion.tsx` 의 `.tv-faq`). 움직임은 `Reveal` 이 켜는 `tv-r*` 뿐이다.
 *
 * 답은 전부 브리프의 사실 정책 안에 있다(시작 방법 · 데스크톱 베타(`app/(static)/download/page.tsx`) ·
 * 종료와 검토 완료 · 「철회됨」(`note-timeline.tsx`
 * `metaOf`) · 줄마다 수정 · 제외와 「제외 취소」(`review-row.tsx`, 「결정 N」은 남은 줄만 센다 —
 * `review-section.tsx` `includedCount`) · 이전 결정 대체). 가격 · 지원 언어 · 모바일 앱 같은 항목은
 * 우리에게 없어서 묻지 않는다.
 */

const LINK = `${HAND} mt-1 inline-flex min-h-11 items-center gap-1 rounded-sm underline decoration-[var(--tv-pop)] decoration-[3px] underline-offset-4 ${FOCUS}`;

/** 큰 번호. 띠는 닫힘 = 버터, 펼침 · 올림 = 노랑. `tv-rmark` 가 구간이 보일 때 띠를 칠한다. */
const NUM =
  "tv-rmark -mx-1 inline-block bg-[linear-gradient(var(--tv-butter),var(--tv-butter))] bg-no-repeat px-1 text-[30px] leading-none font-extrabold tracking-[-0.04em] text-[var(--tv-ink)] tabular-nums [background-position:0_92%] [background-size:100%_0.42em] group-open:bg-[linear-gradient(var(--tv-pop),var(--tv-pop))] group-hover/sum:bg-[linear-gradient(var(--tv-pop),var(--tv-pop))] lg:text-[38px]";

/** `Link` 다 — 다른 경로(`/download`)로 가는 링크가 일반 `<a>` 면 문서를 다시 받아 녹음 중이던 회의가 끊긴다. */
function SeeLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={LINK}>
      {children}
      <ArrowRight aria-hidden className="size-4 shrink-0" />
    </Link>
  );
}

/**
 * 넓은 화면 아래의 창 그림자. 펼침 애니메이션 때문에 `::details-content` 가 `overflow:hidden` 이라
 * (`motion.tsx`) 창 그림자가 답 칸 밖으로 번지면 잘린다 — 390 에서 `SHADOW.panel` 의 옆 번짐(24px)이
 * 칸 가장자리에서 끊겨 좌우가 각진 회색 판이 남았다. 같은 색 그림자를 줄여 옆 10px · 아래 20px 안에
 * 둔다. 넓은 화면은 `SHADOW.panel` 그대로이고, 아래 번짐(48px)은 `lg:mb-5` 가 답 칸 아래 여백과
 * 합쳐 받는다.
 */
const SHADOW_NARROW =
  "max-lg:shadow-[0_10px_20px_-10px_rgba(40,24,120,0.3),0_1px_3px_rgba(12,10,9,0.05)]";

/**
 * 답 안의 앱 조각 자리. 좁은 화면에서는 답의 들여쓰기(번호 칸 60px)를 대부분 상쇄해 기둥 폭을 거의
 * 다 쓰고, 양옆 12px 만 남겨 그림자 자리로 둔다 — 들여쓰기를 그대로 두면 320 에서 창이 228px 로
 * 좁아져 안건 제목이 「회.」만 남았다. 도장은 상단바 위 빈 여백에만 걸친다(탭 글자를 가리지 않는다).
 */
function Sample({ children }: { children: ReactNode }) {
  return (
    <div className="relative mt-6 -ml-[48px] max-w-[520px] sm:mx-0 lg:mb-5">
      <ExampleStamp className="absolute -top-[18px] right-4 z-10" />
      <AppWindow className={SHADOW_NARROW}>{children}</AppWindow>
    </div>
  );
}

/**
 * 03 — 회의 중 타임라인 그대로(상단바 · 안건 머리 · 줄 둘). 철회된 줄은 `retracted` 만 넘긴다 — 앱처럼
 * 붉은 「철회됨」이 메타에 저절로 붙어서, `meta` 로 또 넘기면 두 번 선다. 안건 제목은 앱의 말줄임 대신
 * 줄바꿈한다(과장 허용 범위). 360 미만에서는 시간 구간 「10:02 – 지금」을 잘라 보인다 — 줄바꿈만으로는
 * 320 에서 구간 · 개수 · 「논의 중」이 한 줄을 다 먹어 제목 칸이 34px 이 남았고, 「회의실」(39px)이
 * 끊기지 않는 한 낱말이라 「회…」로 잘렸다. 구간을 빼면 제목 칸이 약 117px 이 되어 「회의실 예약」이
 * 한 줄에 다 선다. 「논의 중」 · 「기록 중」은 남으니 기록 중이라는 말은 그대로다.
 * 시각 · 구간 · 개수 · 그어진 제목은 `app.tsx` 가 이미 `APP.muted`(흰 바탕 4.8:1)로 그린다 — 여기서
 * 색을 덮지 않는다. 연한 `--el-muted-soft` 는 점 · 셰브런 · 구분점 같은 장식에만 남는다.
 */
function RetractedSample() {
  return (
    <Sample>
      <MiniBar status="기록 중" tab="타임라인" size="sm" />
      <div className="px-3 pt-2.5 pb-2">
        <AgendaHead
          range="10:02 – 지금"
          title="회의실 예약"
          total={2}
          live
          className="h-auto min-h-[30px] [&_.truncate]:leading-5 [&_.truncate]:break-keep [&_.truncate]:whitespace-normal max-[360px]:[&>span:first-child]:hidden max-[360px]:[&>span:last-child]:pl-2"
        />
        <TimelineList className="mt-1.5">
          <TimelineRow
            at="10:05"
            tone="decision"
            kind="결정"
            retracted
            title="회의실 예약은 목요일로 잡는다"
          />
          <TimelineRow at="10:41" tone="decision" kind="결정" title="회의실 예약은 금요일로 옮긴다" />
        </TimelineList>
      </div>
    </Sample>
  );
}

/**
 * 04 — 요약 탭의 검토 줄. 뺀 줄을 펼친 모습이다: 그어진 채 흐리게 남고, 앱처럼 「제외됨」 한 줄과
 * 「제외 취소」 하나만 선다(「수정」은 뺀 줄에 없다). 머리의 「결정 1」은 남은 줄만 센 앱의 숫자다.
 * 그어진 제목은 펼친 줄의 회색 면(#f0efed) 위라 `APP.muted` 면 4.2:1 — 한 단 진한 `--el-body`(7:1 대)로
 * 올린다(`DecisionRow` 의 주제가 펼친 줄에서 하는 것과 같은 손보기). 뺀 줄은 이 그림에만 있어 여기서 고친다.
 */
function ExcludedSample() {
  return (
    <Sample>
      <MiniBar status="종료됨" tab="요약" size="sm" />
      <div className="px-4 pt-3 pb-3">
        <SectionHead title="결정" count={1} />
        <DecisionRow text="회의실 예약은 금요일로 옮긴다" at="10:41" className="mt-1" />
        <DecisionRow text="점심은 김밥으로 한다" at="10:58" open
          excluded
          className="border-b-0 [&_.line-through]:text-[var(--el-body)]"
        >
          <p className={cn("m-0 text-[12px]", APP.muted)}>제외됨</p>
          <RowActions excluded />
        </DecisionRow>
      </div>
    </Sample>
  );
}

const QA: Array<{ q: string; a: ReactNode; more?: ReactNode }> = [
  {
    // 웹 · 데스크톱을 나란히 말하는 곳은 여기다(회의 앱 띠 리드는 데스크톱 앱 한 줄과 링크만). 전의 「설치해야
    // 하나요?」 → 「브라우저에서 바로」는 데스크톱 베타가 있는데 설치가 없는 것처럼 읽혔다. 웹과 데스크톱을
    // 사실대로 나란히 말하고 「설치할 것 없음」 류로 못 박지 않는다(`hero.tsx`). 질문을 「어디서 쓰나요?」로
    // 두면 바로 다음 구간 제목(「어디서 회의하든」 — 회의 앱 · 오프라인)과 부딪혀 회의 장소를 묻는 말로 읽혔다.
    // 데스크톱 문구는 `app/(static)/download/page.tsx` 결이다(컴퓨터에서 나는 소리 녹음 · 메뉴바 타임라인을 「더했다」,
    // Windows 는 설치 · 녹음 실제 검증 진행 중).
    q: "브라우저로 쓰나요, 앱도 있나요?",
    // 첫마디가 「둘 다」여야 한다 — 「브라우저에서 씁니다」로 시작했을 때는 앱이 있다는 말이 넷째 문장에야 나와
    // 처음 보는 사람은 데스크톱 앱이 있는 줄 몰랐다. 앱이 더하는 것은 다운로드 페이지와 같은 강도로만 쉬운 말로
    // 옮긴다(「컴퓨터 오디오 녹음」 → 「컴퓨터에서 나는 소리까지 녹음」). 「화상회의 상대 목소리를 받아 적는다」는
    // 설치 앱의 두 입력 전사 수용(`apps/desktop/docs/release.md`)이 끝난 뒤에야 쓴다.
    a: (
      <>
        <span className={MARKER}>둘 다 됩니다.</span> 브라우저에서 바로 쓸 수 있고, Mac · Windows용
        데스크톱 앱(베타)도 있습니다. 데스크톱 앱은 마이크에 더해 컴퓨터에서 나는 소리까지 녹음하고,
        메뉴바에서 타임라인을 볼 수 있습니다. 어느 쪽이든 같은 Google 계정으로 로그인하고 같은 회의
        기록을 봅니다. Windows판은 설치와 녹음을 아직 검증하고 있습니다.
      </>
    ),
    more: <SeeLink href="/download">데스크톱 다운로드</SeeLink>,
  },
  {
    // 주어는 결정과 할 일이다. 회의 자체는 만들 때부터 프로젝트 목록에 한 줄로 있다(팀 구간 리드).
    q: "결정과 할 일은 회의가 끝나면 바로 확정되나요?",
    a: (
      <>
        아니요. 회의를 종료하면 분석을 거쳐 요약 탭에 정리되고,{" "}
        <span className={MARKER}>사람이 검토 완료를 눌러야 프로젝트에 확정됩니다.</span> 기록
        중이면 먼저 「중지」를 눌러야 종료할 수 있습니다.
      </>
    ),
    more: <SeeLink href="#evidence">그림으로 보기</SeeLink>,
  },
  {
    q: "회의 중에 말을 바꾸면요?",
    a: "타임라인은 뒤집힌 항목을 지우지 않습니다. 줄을 긋고 「철회됨」을 붙여 둡니다.",
    more: <RetractedSample />,
  },
  {
    q: "잘못 정리된 줄은 어떻게 하나요?",
    // 「할 일은 … 고칩니다」는 할 일이 고치는 것처럼 읽혀서 「할 일의 … 고칠 수 있습니다」로.
    a: "줄마다 고치거나 뺄 수 있고, 할 일의 담당과 기한도 고칠 수 있습니다. 뺀 줄은 지워지지 않고 그어진 채 남습니다. 「제외 취소」를 누르면 돌아옵니다.",
    more: <ExcludedSample />,
  },
  {
    q: "새 결정이 이전 결정을 뒤집으면요?",
    a: "요약 탭에 「이전 결정 대체」 제안이 붙고, 이전 결정을 끝낼지 유지할지 골라야 합니다. 고르기 전에는 검토 완료가 눌리지 않습니다.",
    more: <SeeLink href="#meetings">주간 회의 카드에서 보기</SeeLink>,
  },
  {
    // 「훑어보고 검토 완료」는 히어로 · 마무리가 말한다. 여기서는 당번이 실제로 손대는 것을 적는다 —
    // 빈 담당 · 기한(`assignee-cell.tsx` · `due-cell.tsx` 「담당/기한 정하기」), 화자 이름(회의 중에는
    // 화자가 없고, 끝난 뒤 스크립트 상단바의 화자 도구 — `speaker-panel.tsx` · `speaker-nudge-banner.tsx`).
    q: "회의록 당번은 이제 뭐 하나요?",
    a: (
      <>
        요약 탭에서 비어 있는 담당과 기한을 채우고, 잘못 잡힌 줄만 고친 다음{" "}
        <span className={MARKER}>검토 완료를 누르면 됩니다.</span> 회의 중에는 화자가 나뉘지
        않아서, 누가 누구인지는 끝난 뒤 스크립트 탭에서 붙여 둡니다.
      </>
    ),
  },
];

/** 노란 「?」 쪽지(말풍선 꼴 — 왼쪽 아래 모서리만 뾰족). 구간이 보일 때 튀어나온다. */
function QMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "tv-rpop grid shrink-0 place-items-center bg-[var(--tv-pop)] font-extrabold text-[var(--tv-ink)]",
        SHADOW.sticky,
        className
      )}
      style={{ rotate: "-6deg" }}
    >
      ?
    </span>
  );
}

export function Faq() {
  return (
    <section
      id="faq"
      className={`scroll-mt-20 bg-[var(--tv-lav-soft)] [interpolate-size:allow-keywords] ${SECTION_Y.color}`}
    >
      <Reveal className={`${CONTAINER} grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16`}>
        <div className="self-start lg:sticky lg:top-24">
          <div className="flex items-center gap-4">
            <h2 className={H2}>자주 묻는 것</h2>
            <QMark className="size-11 rounded-[14px] rounded-bl-[4px] text-[24px] lg:hidden" />
          </div>
          {/* 넓은 화면의 왼쪽 기둥 — 노란 「?」 쪽지가 목록 쪽으로 화살표를 그린다. */}
          <div aria-hidden className="relative mt-10 hidden lg:block">
            <QMark className="ml-2 size-24 rounded-[26px] rounded-bl-[6px] text-[46px]" />
            <Scribble
              kind="arrow-long"
              rotate={-6}
              draw="reveal"
              delay={250}
              className="absolute top-1 left-[128px]"
            />
          </div>
          {/* 농담 — 히어로의 「이번 주 회의록 당번 누구예요?」에 대한 늦은 대답이고(이서연은 마무리
              당번표의 3주 차), 정우재가 06 을 번호로 가리킨다. 질문은 06 이 맡고 말풍선은 상황만
              던진다 — 전에는 「그럼 당번은 이제 뭐 해요?」라 06 질문을 한 구간에서 두 번 읽게 했다. */}
          <div aria-hidden className="mt-5 flex flex-col items-start gap-2 lg:mt-12">
            <Speech who="이서연" tone="butter" tilt={-2} anim="reveal" delay={500}>
              저 이번 주 당번인데요…
            </Speech>
            <Speech
              who="정우재"
              side="right"
              tone="white"
              size="sm"
              tilt={3}
              anim="reveal"
              delay={1000}
              className="ml-12"
            >
              06번 보세요
            </Speech>
          </div>
        </div>

        <div className="border-t border-[var(--tv-rule-strong)]">
          {QA.map(({ q, a, more }, i) => (
            <details
              key={q}
              className="tv-faq group border-b border-[var(--tv-rule-strong)]"
            >
              <summary
                className={`group/sum grid cursor-pointer list-none grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-3 rounded-lg py-5 marker:hidden lg:grid-cols-[64px_minmax(0,1fr)_36px] lg:gap-4 lg:py-6 [&::-webkit-details-marker]:hidden ${FOCUS}`}
              >
                <span aria-hidden className="justify-self-start">
                  <span className={NUM} style={vars({ "--d": `${200 + i * 90}ms` })}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="break-keep text-[17px] leading-[1.4] font-bold text-[var(--tv-ink)] lg:text-[20px]">
                  {q}
                </span>
                <span
                  aria-hidden
                  className="grid size-8 place-items-center rounded-full bg-[var(--tv-butter)] transition-colors group-open:bg-[var(--tv-pop)] group-hover/sum:bg-[var(--tv-pop)] motion-reduce:transition-none lg:size-9"
                >
                  <ChevronDown className="size-4 text-[var(--tv-ink)] transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </span>
              </summary>
              <div className="pr-3 pb-7 pl-[60px] lg:pr-12 lg:pl-[80px]">
                <p className={BODY}>{a}</p>
                {more}
              </div>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
