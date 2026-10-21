import type { ReactNode } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { localePath } from "@/lib/i18n/locales";
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
import { RICH } from "./rich";
import {
  APP,
  BODY,
  CONTAINER,
  FOCUS,
  H2,
  HAND,
  MARKER,
  SECTION_Y,
  SHADOW,
  vars,
} from "./tokens";

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
 * 답은 전부 브리프의 사실 정책 안에 있다(시작 방법 · 데스크톱 앱(`app/[lang]/download/page.tsx`) ·
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
  const t = useTranslations("landing.faq.retracted");
  return (
    <Sample>
      <MiniBar status="recording" tab="timeline" size="sm" />
      <div className="px-3 pt-2.5 pb-2">
        <AgendaHead
          range={t("range")}
          title={t("agenda")}
          total={2}
          live
          className="h-auto min-h-[30px] [&_.truncate]:leading-5 [&_.truncate]:whitespace-normal max-[360px]:[&>span:first-child]:hidden max-[360px]:[&>span:last-child]:pl-2"
        />
        <TimelineList className="mt-1.5">
          <TimelineRow
            at="10:05"
            tone="decision"
            kind={t("kind")}
            retracted
            title={t("before")}
          />
          <TimelineRow
            at="10:41"
            tone="decision"
            kind={t("kind")}
            title={t("after")}
          />
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
  const t = useTranslations("landing.faq.excluded");
  return (
    <Sample>
      <MiniBar status="ended" tab="summary" size="sm" />
      <div className="px-4 pt-3 pb-3">
        <SectionHead title={t("section")} count={1} />
        <DecisionRow text={t("kept")} at="10:41" className="mt-1" />
        <DecisionRow
          text={t("dropped")}
          at="10:58"
          open
          excluded
          className="border-b-0 [&_.line-through]:text-[var(--el-body)]"
        >
          <p className={cn("m-0 text-[12px]", APP.muted)}>{t("note")}</p>
          <RowActions excluded />
        </DecisionRow>
      </div>
    </Sample>
  );
}

/** 답 안의 강조 — 버터색 형광펜. */
const MARK = {
  ...RICH,
  m: (chunks: ReactNode) => <span className={MARKER}>{chunks}</span>,
};

/**
 * 질문 · 답(`landing.faq.items` 의 q1~q6, 순서가 번호다). 화면과 JSON-LD(`landing-client.tsx`)가 같은 글을 쓴다.
 * 서버 컴포넌트에서도 부르므로 `useTranslations` · `useLocale` 만 쓴다.
 *
 * - 01: 웹 · 데스크톱을 나란히 말하는 곳은 여기다(회의 앱 띠 리드는 데스크톱 앱 한 줄과 링크만). 첫마디가 「둘
 *   다」여야 한다 — 앱이 있다는 말이 넷째 문장에야 나오면 처음 보는 사람은 데스크톱 앱이 있는 줄 모른다. 앱이
 *   더하는 것은 다운로드 페이지(`app/[lang]/download/page.tsx`)와 같은 강도로만 옮긴다(컴퓨터에서 나는 소리 녹음 ·
 *   메뉴바 타임라인, Windows 는 베타). 「화상회의 상대 목소리를 받아 적는다」는 설치 앱의 두 입력 전사
 *   수용(`apps/desktop/docs/release.md`)이 끝난 뒤에야 쓴다. 질문을 「어디서 쓰나요?」로 두면 다음 구간 제목
 *   (「어디서 회의하든」)과 부딪혀 회의 장소를 묻는 말로 읽혔다.
 * - 02: 주어는 결정과 할 일이다. 회의 자체는 만들 때부터 프로젝트 목록에 한 줄로 있다(팀 구간 리드).
 * - 06: 「훑어보고 검토 완료」는 히어로 · 마무리가 말한다. 여기서는 당번이 실제로 손대는 것을 적는다 — 빈 담당 ·
 *   기한(`assignee-cell.tsx` · `due-cell.tsx`), 화자 이름(끝난 뒤 스크립트 상단바의 화자 도구 — `speaker-panel.tsx`).
 */
export function useFaqQA(): Array<{
  q: string;
  a: ReactNode;
  more?: ReactNode;
}> {
  const t = useTranslations("landing.faq.items");
  const locale = useLocale();
  const item = (id: "q1" | "q2" | "q3" | "q4" | "q5" | "q6") => ({
    q: t(`${id}.q`),
    a: t.rich(`${id}.a`, MARK),
  });
  return [
    {
      ...item("q1"),
      more: (
        <SeeLink href={localePath(locale, "/download")}>{t("q1.more")}</SeeLink>
      ),
    },
    { ...item("q2"), more: <SeeLink href="#evidence">{t("q2.more")}</SeeLink> },
    { ...item("q3"), more: <RetractedSample /> },
    { ...item("q4"), more: <ExcludedSample /> },
    { ...item("q5"), more: <SeeLink href="#meetings">{t("q5.more")}</SeeLink> },
    item("q6"),
  ];
}

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
  const t = useTranslations("landing.faq");
  const qa = useFaqQA();
  return (
    <section
      id="faq"
      className={`bg-[var(--tv-lav-soft)] [interpolate-size:allow-keywords] ${SECTION_Y.color}`}
    >
      <Reveal
        className={`${CONTAINER} grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-16`}
      >
        <div className="self-start lg:sticky lg:top-24">
          <div className="flex items-center gap-4">
            <h2 className={H2}>{t("title")}</h2>
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
          <div
            aria-hidden
            className="mt-5 flex flex-col items-start gap-2 lg:mt-12"
          >
            <Speech
              who="seoyeon"
              tone="butter"
              tilt={-2}
              anim="reveal"
              delay={500}
            >
              {t("speech.duty")}
            </Speech>
            <Speech
              who="woojae"
              side="right"
              tone="white"
              size="sm"
              tilt={3}
              anim="reveal"
              delay={1000}
              className="ml-12"
            >
              {t("speech.pointer")}
            </Speech>
          </div>
        </div>

        <div className="border-t border-[var(--tv-rule-strong)]">
          {qa.map(({ q, a, more }, i) => (
            <details
              key={q}
              className="tv-faq group border-b border-[var(--tv-rule-strong)]"
            >
              <summary
                className={`group/sum grid cursor-pointer list-none grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-3 rounded-lg py-5 marker:hidden lg:grid-cols-[64px_minmax(0,1fr)_36px] lg:gap-4 lg:py-6 [&::-webkit-details-marker]:hidden ${FOCUS}`}
              >
                <span aria-hidden className="justify-self-start">
                  <span
                    className={NUM}
                    style={vars({ "--d": `${200 + i * 90}ms` })}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="text-[17px] leading-[1.4] font-bold text-[var(--tv-ink)] lg:text-[20px]">
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
