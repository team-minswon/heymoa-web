"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Pause, Play } from "lucide-react";

import { useDemo, useInView, type Demo } from "@/components/heymoa/landing/use-demo";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import { cn } from "@/lib/utils";

import { AppWindow, Face } from "./app";
import {
  ANSWERED_NARROW_MS,
  CAPTION,
  CHAPTER_OF,
  CHAPTERS,
  HOLD_MS,
  ROW_IN_MS,
  SCENE_TAB,
  sceneOf,
  type Moment,
  type Scene,
} from "./hero-data";
import { HeroNote } from "./hero-note";
import { HeroRail } from "./hero-rail";
import { useOnceInView, useReducedMotion } from "./hooks";
import { Hand, Scribble, Sticky, Tape } from "./marks";
import { FOCUS, STAGE_WRAP, vars } from "./tokens";

/*
 * 히어로 무대 — 라벤더 색 면 위에 **창 둘이 나란히** 선다(노트 · 내 에이전트, 앱처럼 서로 감싸지 않는 별개의
 * 패널). 테두리는 창마다 하나(그림자)뿐이고 무대에는 선이 없다. 모바일은 색 면을 **창 위끝까지만**(창이
 * 8px 덮는다) 깔아 창 위를 지나가는 띠로 읽히게 한다 — **창 옆에 평행한 색 띠를 두지 않는다.** 창 머리
 * 아래까지 깔았더니 16px 거터의 라벤더가 창 가장자리와 나란히 서서 테두리로 읽혔고, 창 위쪽 절반만 쟁반에
 * 끼운 액자 속 액자가 됐다. 같은 이유로 lg ~ xl 미만(1024 ~ 1279)은 창 양옆 라벤더를 32px(`lg:px-8`)로
 * 넓힌다 — 16 이던 때 1024 ~ 1090 에서 흰 페이지 → 16px 라벤더 → 흰 창이 테두리 두 겹으로 읽혔다. 더 넓히지
 * 않는 까닭: 1024 노트 창이 584 아래로 줄면 중지된 뒤 「⋯」가 붙을 때 제목 「3차 스프린트 킥오프」가
 * 말줄임된다(616 일 때 남는 자리가 76, 「⋯」가 44 를 쓴다). 위 띠(테이프 · 일시정지)도 같은 32 에 맞춘다.
 *
 * 창은 `use-demo.ts` 의 대본으로 혼자 회의 한 바퀴를 돈다. 쪽지 · 말풍선 · 화살표(페이지의 말, `--tv-*`)는
 * **창 밖에만 선다** — 왼쪽 · 오른쪽 거터와 창 위 띠. 창 안으로는 창 가장자리 여백(본문 패딩)까지만 걸친다
 * (화면 규칙 7). 예외는 화살표 둘이다 — ① 쪽지와 검토 막대 쪽지의 화살표는 독 · 막대 왼쪽의 빈 바닥 띠를
 * 지나 그 왼쪽 끝 앞에서 멈춘다(앱 글자 위를 지나지 않는다). 쪽지는 장면(`sceneOf`)이 바뀔 때마다 갈아
 * 끼워져 튀어나온다. 창 안의 커서 · 섬광 · 고리는 `hero-note.tsx` 가 같은 장면을 보고 그린다. 넓은 거터가
 * 없는 화면(xl 미만)은 쪽지 대신 위 띠의 자막 한 장으로 말한다.
 *
 * 쪽지가 가리키는 줄은 **재서 맞춘다**(`useMarkEdges`) — 노트 창 안의 `data-mark`(받아 적는 줄 · 방금 붙은
 * 줄 · 근거의 인용 줄)를 렌더 · 창 안 스크롤 · 창 크기가 바뀔 때마다 재서 `--mt` · `--mb` 로 적는다. 줄
 * 높이가 글꼴 · 폭마다 달라서 숫자로 박아 둔 자리는 늘 몇십 px 씩 빗나갔다.
 *
 * 일시정지는 창 위 띠, 「예시 회의」 테이프 바로 옆의 진짜 버튼이다(WCAG 2.2.2). 창보다 먼저 포커스를
 * 받고, 1440×900 첫 화면 안에 선다. 대본 상태가 얼면 장면도 쪽지도 그 자리에 서고, 혼자 도는 그림(파형 ·
 * 커서 · 깜빡임)은 무대의 `data-paused` 가 세운다. 모션을 줄였으면 처음부터 마지막 장면이다.
 *
 * 창 높이(`WINDOW_H`) — **브라우저의 보이는 높이**로 잰다(기기 화면 크기로 재면 툴바에 가린 만큼 틀린다).
 * 1440×900 은 500 그대로(창 바닥 ≈ 879). 높이 721~890(1366×768 · 1280×800 · 1440×790)은 창 위끝 ≈ 347
 * (상단 바 64 + 24 + 머리 191 + 12 + 띠 56, `hero.tsx`)이라 `100svh − 355`, 720 이하(1366×650 = 1366×768
 * 노트북의 Chrome · 1280×700)는 제목이 줄어 창 위끝 ≈ 321 이라 `100svh − 329`(최소 300) — 어느 쪽이든 창
 * 바닥이 보이는 높이 8px 위에 와서 독 · ① 쪽지의 화살표 · 검토 막대와 그 쪽지가 첫 화면에 든다.
 * 모바일은 `100svh − 480`(340~440): 390×844 는 창 위끝 ≈ 472 라 창 전체가 들고, 390×664 · 375×553(툴바를 편
 * 실제 Safari)은 창 위끝 ≈ 452(높이 600 이하는 ≈ 420, `hero.tsx`)라 창 머리(상단바 · 탭 줄)부터 든다 — 대본은
 * 그것만 보여도 돈다(감시 점).
 * 창을 그 높이에 맞춰 줄이지 않는 까닭: 664 에서 받아 적는 줄까지 들이려면 창이 약 210 이 되어 타임라인 ·
 * 검토 장면이 한두 줄만 남는다.
 */

/** `el` 의 위 · 아래 가장자리를 `host` 기준으로 잰다. offset 으로 재서 등장 애니메이션(translate)에 안 흔들리고, 사이의 스크롤 상자가 굴린 만큼 뺀다. */
function edgesIn(el: HTMLElement, host: HTMLElement) {
  let top = 0;
  let at: HTMLElement | null = el;
  while (at && at !== host) {
    top += at.offsetTop;
    const parent = at.offsetParent as HTMLElement | null;
    if (parent && parent !== host) top -= parent.scrollTop;
    at = parent;
  }
  return [top, top + el.offsetHeight] as const;
}

/**
 * 노트 창의 가리킬 줄 — `data-mark` 가 목록(타임라인 안건의 `ol`, 근거 상자)이면 그 **마지막 줄**(방금 붙은
 * 항목, 인용한 발언)이다.
 */
const noteMark = (host: HTMLElement) => {
  const mark = host.querySelector<HTMLElement>("[data-mark]");
  return mark?.querySelector<HTMLElement>("li:last-child") ?? mark;
};
/** 레일의 가리킬 줄 — 마지막 왕복의 「참고한 회의록 N개」 줄(`hero-rail.tsx` 의 `data-refs`). */
const railMark = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-refs] button");

/**
 * 가리킬 줄이 제 스크롤 상자(`data-view`)의 **보이는 칸 안에 다 들었나.** 칸의 바닥은 확정 막대의 흰 막
 * (`data-cover`)이 있으면 그 위끝, 없으면 바닥 흐림(`data-view` 의 px) 위다. 그리고 같은 거터 아래에 선 쪽지
 * (`data-note-floor`, 검토 막대 쪽지)가 있으면, 이 줄을 가리킬 80px 쪽지가 그 쪽지 위 8px 안에서 끝나야 한다 —
 * 낮은 창(1280×700)에서 근거 쪽지가 검토 막대 쪽지와 맞닿았다.
 */
function markShown(target: HTMLElement, host: HTMLElement, top: number, bottom: number) {
  const box = target.closest<HTMLElement>("[data-view]");
  if (box) {
    const [boxTop, boxBottom] = edgesIn(box, host);
    const cover = box.querySelector<HTMLElement>("[data-cover]");
    const floor = cover?.parentElement
      ? boxBottom - cover.parentElement.offsetHeight + (parseFloat(cover.style.top) || 0)
      : boxBottom - (Number(box.dataset.view) || 0);
    if (top < boxTop || bottom > floor) return false;
  }
  const below = host.querySelector<HTMLElement>("[data-note-floor]");
  return !below?.offsetParent || (top + bottom) / 2 + 48 <= below.offsetTop;
}

/**
 * 가리킬 줄(`find`)의 위 · 아래 가장자리를 `host` 의 `--mt` · `--mb` 로, 그 줄이 보이는 칸 안에 들었는지를
 * `--mvis`(visible · hidden)로 적는다. 리렌더 없이 DOM 에만 적는다(쪽지 자리는 상태가 아니다). 대본이 쉬는 동안
 * 창 안이 부드럽게 굴러도 따라가게 스크롤(캡처)도 듣는다. 창 안의 스크롤 · 흰 막은 자식(창)의 효과가 먼저
 * 정하고, 이 효과는 그 뒤에 돈다.
 *
 * `--mvis` 를 쓰는 것은 화살표가 그 줄 하나를 가리키는 쪽지(근거 · 레일 손글씨)뿐이다 — 낮은 창에서 그 줄이
 * 창 밖 · 흰 막 밑 · 입력창 밑에 있으면 화살표가 빈자리나 다른 UI(입력창의 범위 칩)를 가리켰다.
 */
function useMarkEdges(find: (host: HTMLElement) => HTMLElement | null | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const measure = useCallback(() => {
    const host = ref.current;
    if (!host) return;
    const target = find(host);
    // 없거나, 방문자가 그 안건을 접어 두었으면 잴 것이 없다 — 쪽지는 기본 자리(창 아래 띠)로 간다.
    if (!target?.offsetParent) {
      for (const name of ["--mt", "--mb", "--mvis"]) host.style.removeProperty(name);
      return;
    }
    const [top, bottom] = edgesIn(target, host);
    host.style.setProperty("--mt", `${top}px`);
    host.style.setProperty("--mb", `${bottom}px`);
    host.style.setProperty("--mvis", markShown(target, host, top, bottom) ? "visible" : "hidden");
  }, [find]);
  useEffect(() => measure());
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      host.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);
  return ref;
}

/**
 * 회의실에서 지금 나는 말 — 얼굴 + 흰 말풍선(페이지 장식, 꼬리 있음). 이름은 안 쓴다: 회의 중에는 앱도
 * 누가 말하는지 모른다. 창 안 스크립트에 같은 말이 한 글자씩 받아 적히는 것과 나란히 보인다.
 */
function Voice({ line }: { line: NonNullable<Demo["live"]>["line"] }) {
  return (
    <span className="tv-pop flex items-end gap-1.5" style={{ rotate: "-2deg" }}>
      <Face who={line.who} size={26} className="shrink-0" />
      {/* 세 줄에서 자른다 — 다 보이면 40자 줄이 거터에서 다섯 줄로 서서 범례 쪽지와 붙고 창 왼쪽을
          덮었다. 같은 말이 창 안에 다 받아 적히므로 말풍선은 말머리만 보여도 된다.
          **여백 · 테두리 · 바탕은 바깥 상자, `line-clamp` 는 안쪽 글자 상자에만 둔다.** 한 상자에 같이 두면
          overflow 가 padding 바깥에서 잘라서 넷째 줄 윗부분이 아래 여백 안에 반쯤 비쳤다. */}
      <span className="rounded-[16px] rounded-bl-[4px] border-[1.5px] border-[var(--tv-ink)] bg-white px-2.5 py-2 shadow-[0_6px_14px_-6px_rgba(60,40,0,0.35)]">
        <span className="line-clamp-3 text-[12px] leading-[1.45] font-bold break-keep text-[var(--tv-ink)]">
          {line.text}
        </span>
      </span>
    </span>
  );
}

/** 쪽지 안 둘째 줄(작은 보조 말). */
function Sub({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 block text-[12px] font-bold text-[var(--tv-body)]">{children}</span>;
}

type Note = {
  text: ReactNode;
  sub?: ReactNode;
  tone: ComponentProps<typeof Sticky>["tone"];
  tilt: number;
  delay?: number;
  /** 탭과 무관한 장면(독 · 상단바)이면 참. 아니면 기대한 탭이 떠 있을 때만 선다. */
  anyTab?: boolean;
};

/** 멈춤 세 장면(독에서 ■ → 중지됨 → 회의 종료 누름) 동안 왼쪽 거터 아래에 그대로 선다. */
const STEP_1: Note = {
  text: "① 먼저 멈추고",
  sub: (
    <>
      기록 중엔 <span className="whitespace-nowrap">바로 못 끝내요</span>
    </>
  ),
  tone: "butter",
  tilt: -2,
};
/**
 * 앱은 「회의 종료」를 누르면 확인창(「회의를 종료할까요?」, `meeting-end-dialog.tsx`)을 먼저 띄운다. 이
 * 대본은 그 창을 건너뛰고 바로 「종료됨」이 되므로, 한 번에 끝나는 것으로 읽히지 않게 쪽지가 말한다 — 검토
 * 완료를 누르지 않는 까닭(`hero-note.tsx` `ReviewDoc`)과 같은 규칙이다. 좁은 화면 자막은 20자라 싣지 않는다.
 */
const STEP_2: Note = {
  text: "② 그다음 회의 종료",
  sub: "누르면 한 번 더 물어봐요",
  tone: "butter",
  tilt: 2,
  delay: 250,
  anyTab: true,
};

/**
 * D — 가리킬 줄(`data-mark`) 높이의 왼쪽 거터 쪽지. 짧은 화살표가 창 왼쪽 본문 여백(32px) 안에서 그 줄을
 * 가리키고 멈춘다 — 쪽지는 창 안에 서지 않는다. 받아 적기는 글자가 흐르는 동안, 할 일 · 열린 질문은 **다음
 * 말이 흐르기 전까지만** 선다 — 그다음엔 맨 아래가 받아 적는 줄로 바뀌어 가리킬 줄이 위로 밀려난다.
 * 「모든 말이 항목이 되진 않아요」는 그때 회의실 말풍선 위 손글씨가 말한다. 줄은 뜻 단위로만 갈린다
 * (136px 거터라 두세 줄이 된다 — 「주황 / 점선」처럼 낱말 가운데서 끊기지 않게). 할 일 · 열린 질문 쪽지는
 * 가리킬 새 줄이 다 든 뒤(`ROW_IN_MS`)에 선다 — 같이 서면 화살표가 아직 빈 자리를 가리켰다.
 */
const BELOW: Partial<Record<Scene, Note>> = {
  listen: {
    text: (
      <>
        말이 끝날 때마다 <span className="whitespace-nowrap">시각을 달고 한 줄씩</span>
      </>
    ),
    tone: "butter",
    tilt: -2,
  },
  task: {
    text: (
      <>
        방금 나온 <span className="whitespace-nowrap">할 일,</span>{" "}
        <span className="whitespace-nowrap">벌써 붙었어요</span>
      </>
    ),
    tone: "pop",
    tilt: 2,
    delay: ROW_IN_MS,
  },
  open: {
    text: (
      <>
        답 못 한 질문은 <span className="whitespace-nowrap">주황 점선으로</span> 남아요
      </>
    ),
    tone: "peach",
    tilt: 2,
    delay: ROW_IN_MS,
  },
};

/**
 * 가리킬 줄의 한가운데에 맞춘 80px 칸의 위끝. 위로는 거터 위쪽 쪽지(범례 · 받아 적기 장면의 회의실
 * 말풍선, `--a` 에서 약 110px) 밑에서, 아래로는 창 바닥 12px 위에서 멈춘다.
 */
const MARK_TOP =
  "clamp(calc(var(--a) + 120px), calc((var(--mt, 300px) + var(--mb, 340px)) / 2 - 40px), calc(100% - 92px))";

/**
 * 마지막 장면의 쪽지. 검토 막대가 창 바닥 가운데를 차지하므로 왼쪽 거터 아래에 서서 막대를 가리킨다.
 * 앱 동작 이름 「검토 완료」와 「안 올라가요」는 두 줄로 갈리지 않게 묶는다.
 */
const CONFIRM: Note = {
  text: (
    <>
      훑어보고, 맞으면 <span className="whitespace-nowrap">검토 완료</span>
    </>
  ),
  sub: (
    <>
      누르기 전엔 프로젝트에 <span className="whitespace-nowrap">안 올라가요</span>
    </>
  ),
  tone: "pop",
  tilt: -3,
  delay: 200,
};

/**
 * E — 노트 창 위 띠, 회의 종료 버튼 · 요약 탭 근처. 「② 그다음 회의 종료」는 둘째 줄(앱의 종료 확인창을
 * 건너뛴다는 것)까지 약 53px 라 위 띠(56)에서 위로 4px 남짓 무대 밖에 걸친다 — 버튼 쪽 모서리는 기울기로
 * 내려가 히어로 버튼과 닿지 않는다(1366 · 1280 의 낮은 화면에서도 약 10px 틈).
 */
const ABOVE: Partial<Record<Scene, Note>> = {
  paused: STEP_2,
  press: STEP_2,
  ended: { text: "회의 끝! 요약 탭으로 넘어가요", tone: "pop", tilt: -2, anyTab: true },
  // 분석이 얼마나 걸리는지는 단정하지 않는다(앱 문구는 「몇 분 걸릴 수 있고」). 빨리 감는다는 말은 이 쪽지
  // 하나만 한다 — 창 안 쪽지는 글자 없는 「>>>」 표시다(`hero-note.tsx` `Analyzing`). 둘 다 글로 말했을 때는
  // 「빨리 감는 중」 · 「빨리 감았어요」가 한 장면에서 시제까지 엇갈렸다. 지금 일어나는 일이라 현재형이다.
  analyzing: { text: "분석은 여기선 빨리 감아요", tone: "pop", tilt: 2 },
  doc: { text: "요약 탭이 회의록 한 장이 돼요", tone: "mint", tilt: -2 },
};

function NoteSticky({ note }: { note: Note }) {
  return (
    <Sticky tone={note.tone} tilt={note.tilt} anim="pop" delay={note.delay} className="block">
      {note.text}
      {note.sub ? <Sub>{note.sub}</Sub> : null}
    </Sticky>
  );
}

/**
 * 노트 창 둘레의 쪽지 자리(xl 이상만, 왼쪽 거터 136px). A 왼쪽 거터 위 · B 회의실 말풍선 · D 가리킬 줄
 * 높이 · ① · 검토 막대 쪽지는 왼쪽 거터 아래 · E 창 위 띠. **쪽지는 모두 창 밖이다** — 거터에서는 창의
 * 왼쪽 본문 여백(32~40px)까지만 걸친다(가장 많이 걸친 것이 ① · 검토 막대 쪽지의 24px). 한 장면에
 * 쪽지는 둘까지이고, 회의 중 말풍선(B)이 하나 더 설 수 있다. 쪽지 바닥은 모두 창 바닥 12px 위다.
 *
 * 세로 자리: 근거 쪽지와 D 는 `--mt` · `--mb`(가리킬 줄, `useMarkEdges`)에 붙고, 나머지는 창 위 · 아래
 * 가장자리에 붙는다. A 의 위끝 `--a` 는 창이 낮은 화면에서 올라간다 — 118(창 500) · 76(높이 721~890, 창
 * 366~) · 16(높이 720 이하, 창 300~). 범례(약 110)의 바닥이 B(아래 96 + 약 90)의 위끝보다 위에 서게 한
 * 값이다(1366×650 의 창 321 에서 126 대 135). B 는 받아 적기 장면에서만 A 자리(위)에 서고 화살표가 없다 —
 * 그 자리에서 오른쪽을 가리키면 받아 적는 줄(창 아래)이 아니라 엉뚱한 앞 줄(00:14)에 닿았다. 받아 적는
 * 줄은 그때 D 가 가리킨다. B 의 말풍선은 세 줄에서 잘린다(여백은 바깥 상자, clamp 는 안쪽 글자 상자 —
 * `Voice`) — 1366×768 에서 다섯 줄로 서서 A 바닥과 8px 로 붙었다.
 *
 * 가로 자리(창 왼쪽 = 0, 무대 왼쪽 = −136): A 는 −120 ~ 12(폭 132 — 150 이던 때 1280 에서 무대 밖 x 20 에
 * 걸렸다), B 는 −132 ~ 8(폭 140 — 160 · 24 이던 때 1366 에서 창을 25px 덮었다), D 의 화살 끝 28, ① · 검토
 * 막대 쪽지는 −144 ~ 24, 독 왼쪽 끝 약 216(632 창). 거터 폭은 xl 이상에서 늘 136 이고, 1280 은 무대 왼쪽이
 * 페이지 가장자리에서 24px 라 무대 밖으로 나간 만큼 흰 여백에 걸린다.
 */
function NoteNotes({ demo, scene, tabOk }: { demo: Demo; scene: Scene; tabOk: boolean }) {
  const live = demo.live;
  const typing = (live?.text.length ?? 0) > 0;
  const legend = tabOk && (scene === "timeline" || scene === "task" || scene === "open");
  const evidence = tabOk && (scene === "evidence" || scene === "confirm");
  const below = tabOk && (scene === "listen" ? typing : !typing) ? BELOW[scene] : undefined;
  const step = scene === "stop" || scene === "paused" || scene === "press";
  // ① 의 화살표는 독 왼쪽의 빈 바닥 띠를 지난다 — 그 띠는 따라가는 탭(스크립트 · 타임라인)만 비워 둔다.
  const stepArrow = scene === "stop" && (demo.noteTab === "스크립트" || demo.noteTab === "타임라인");
  const e = ABOVE[scene] && (ABOVE[scene].anyTab || tabOk) ? ABOVE[scene] : null;
  /** 열린 질문 장면에서 받아 적히는 01:48 의 말 — 항목이 되지 않는 말이다. */
  const idle = scene === "open" && live?.line.at === "01:48";
  /**
   * 회의실 말풍선(B)은 받아 적기 장면에서는 **첫 글자가 창에 받아 적히기 시작한 뒤**에 선다(D 쪽지와 같은 기준).
   * 대본이 돌기 전(창 등장 · 시작 대기 0.8초)부터 01:19 의 말을 세웠더니, 창 안 스크립트는 아직 앞 줄이 올라오는
   * 중이라 말풍선이 창보다 한 박자 앞섰다 — 「창 등장과 첫 장면을 겹치지 않는다」는 규칙이 말풍선에도 걸린다.
   * 다른 장면은 줄 사이에도 그대로 둔다(말풍선만 줄마다 갈아 끼운다).
   */
  const voice = live !== null && demo.status === "기록 중" && (scene !== "listen" || typing);

  return (
    <>
      {/* A — 범례. 아이콘은 앱 것, 이름은 앱 필터 이름. 같은 쪽지가 세 장면 동안 서 있고 줄만 는다. */}
      {legend ? (
        <div aria-hidden className="absolute top-[var(--a)] right-full -mr-3 hidden w-[132px] xl:block">
          <Sticky tone="mint" tilt={-3} anim="pop" className="block">
            이렇게 갈라 둬요
            {/* 「할 일」 튐 · 「열린 질문」 줄은 창 안 새 줄이 다 든 뒤(`ROW_IN_MS`)에 선다. */}
            <span className="mt-1.5 flex flex-col gap-1 text-[13px] font-bold">
              <span className="flex items-center gap-1.5">
                <TimelineToneIcon tone="decision" />
                결정
              </span>
              <span className="flex items-center gap-1.5">
                <TimelineToneIcon tone="task" />
                <span
                  key={scene === "task" ? "bump" : "rest"}
                  className={scene === "task" ? "tv-bump [animation-delay:300ms]!" : undefined}
                >
                  할 일
                </span>
              </span>
              {scene === "open" ? (
                <span
                  className="tv-pop flex items-center gap-1.5"
                  style={vars({ "--d": `${ROW_IN_MS}ms` })}
                >
                  <TimelineToneIcon tone="open" />
                  열린 질문
                </span>
              ) : null}
            </span>
          </Sticky>
        </div>
      ) : null}

      {/* B — 회의실의 목소리. 회의 중 말이 흐르는 동안만. 오른쪽 끝은 창 본문 여백 안(8px)에서 멈춘다 —
          시각 열(창 왼쪽 + 32~)과 띄운다. 받아 적기 장면은 위(D 가 맨 아래 받아 적는 줄을 가리킨다, 그래서
          B 의 화살표는 뺀다), 나머지는 아래 — 타임라인 바닥의 받아 적는 줄 옆이라 화살표가 그 줄에 닿는다.
          장면 사이에 말풍선이 사라졌다 서므로 자리를 옮겨도 미끄러지지 않는다. */}
      {voice && live ? (
        <div
          aria-hidden
          className={cn(
            "absolute right-full -mr-2 hidden w-[140px] flex-col items-start gap-1 xl:flex",
            scene === "listen" ? "top-[var(--a)]" : "bottom-[96px]"
          )}
        >
          <span key={idle ? "idle" : "room"} className="relative ml-2 w-[104px]">
            <Hand className={cn("tv-pop block break-keep", idle ? "text-[12.5px]" : "text-[12px]")}>
              {idle ? "모든 말이 항목이 되진 않아요" : "회의실에서"}
            </Hand>
            {scene === "listen" ? null : (
              <Scribble
                kind="arrow"
                draw="mount"
                className="absolute top-1 -right-[60px] h-6 w-10"
                rotate={20}
              />
            )}
          </span>
          <Voice key={live.line.at} line={live.line} />
        </div>
      ) : null}

      {/* 근거 쪽지 — 근거 · 검토 막대 두 장면 동안 선다. 화살표가 인용 줄(「화자 B · 00:14」)의 한가운데를
          가리키고, 문서가 굴러가면 따라 움직인다. 화살 끝은 근거 상자 왼쪽 선 앞에서 멈춘다.
          「누가 몇 분에 한 말인지」는 쓰지 않는다 — 히어로 리드(「누가 한 말인지도 갈라 둡니다」)가 이미 하는 말이다. 이 쪽지는
          가리키는 줄이 **무엇인지**(이 결정이 나온 대목)를 말한다. 「그 말」도 근거 구간 제목 · 손글씨의 말이라
          피했다. 덩어리(「이 결정이 나온」 · 「대목이에요」)마다 줄바꿈을 막아 두 줄로 선다.
          **인용 줄이 보이는 칸 안에 없으면 숨는다**(`--mvis`, `markShown`) — 낮은 창의 검토 막대 장면에서 그 줄은
          위로 넘어갔거나 흰 막 밑인데, 쪽지가 남아 화살표가 빈 흰 면을 가리키고 검토 막대 쪽지와 겹쳤다. */}
      {evidence ? (
        <div
          aria-hidden
          className="absolute right-full -mr-2 hidden h-20 w-[150px] items-center [visibility:var(--mvis,visible)] xl:flex"
          style={{ top: "calc((var(--mt, 220px) + var(--mb, 270px)) / 2 - 40px)" }}
        >
          {/* 0.4초 늦게 — 문서가 인용 줄까지 굴러가는 동안은 숨어 있다가(`--mvis`) 다 든 뒤 튀어나오게. */}
          <Sticky tone="pop" tilt={-3} anim="pop" delay={400} className="block">
            <span className="whitespace-nowrap">이 결정이 나온</span>{" "}
            <span className="whitespace-nowrap">대목이에요</span>
          </Sticky>
          <Scribble
            kind="arrow"
            draw="mount"
            delay={600}
            rotate={20}
            className="absolute top-[calc(50%-16px)] -right-[56px] h-8 w-[52px]"
          />
        </div>
      ) : null}

      {/* D — 가리킬 줄 높이의 거터 쪽지(오른쪽 끝은 창 안 4px). 화살표는 쪽지 오른쪽 여백에서 나와 창 왼쪽
          본문 여백 안(창 왼쪽 + 28)에서 멈춘다 — 그 줄의 시각 · 아이콘 열 앞이다. */}
      {below ? (
        <div
          key={scene}
          aria-hidden
          className="absolute right-full -mr-1 hidden h-20 w-[136px] items-center xl:flex"
          style={{ top: MARK_TOP }}
        >
          <NoteSticky note={below} />
          <Scribble
            kind="arrow"
            draw="mount"
            delay={180 + (below.delay ?? 0)}
            rotate={20}
            className="absolute top-[calc(50%-14px)] left-full -ml-3 h-7 w-10"
          />
        </div>
      ) : null}

      {/* ① — 멈춤 세 장면 동안 왼쪽 거터 아래에 그대로 선다(다시 튀어나오지 않는다, 탭과 무관). 긴 화살표는
          ■ 를 누르는 장면에만, 독 왼쪽의 빈 바닥 띠를 지나 독 왼쪽 끝 앞에서 멈춘다 — 중지되면 독이 좁아져
          화살표가 빈 데를 가리켰다. 화살표 상자의 세로 가운데가 독 가운데(창 바닥 − 38)다. */}
      {step ? (
        <div aria-hidden className="absolute right-full bottom-3 -mr-6 hidden w-[168px] xl:block">
          <NoteSticky note={STEP_1} />
          {stepArrow ? (
            <Scribble
              kind="arrow-long"
              draw="mount"
              delay={180}
              rotate={8}
              className="absolute left-full -bottom-[14px] -ml-2 h-[79px] w-[184px]"
            />
          ) : null}
        </div>
      ) : null}

      {/* 검토 막대 쪽지 — 왼쪽 거터 아래(창 바닥 12px 위에서 끝난다). 화살표는 막대에 가린 흰 막 위로 지나
          막대 왼쪽 끝 앞에서 멈춘다 — 앱 글자 위를 지나지 않는다. */}
      {scene === "confirm" && tabOk ? (
        <div
          aria-hidden
          data-note-floor
          className="absolute right-full bottom-3 -mr-6 hidden w-[168px] xl:block"
        >
          <NoteSticky note={CONFIRM} />
          <Scribble
            kind="arrow"
            draw="mount"
            delay={520}
            rotate={30}
            className="absolute -right-[100px] bottom-[14px] h-[60px] w-[96px]"
          />
        </div>
      ) : null}

      {/* E — 창 위 띠, 회의 종료 · 요약 탭 근처. */}
      {e ? (
        <div aria-hidden className="absolute right-3 bottom-full mb-2 hidden xl:block">
          <span key={e === STEP_2 ? "step-2" : scene} className="relative inline-block">
            <NoteSticky note={e} />
            {e === STEP_2 ? (
              <Scribble
                kind="arrow-down"
                draw="mount"
                delay={420}
                className="absolute right-[60px] -bottom-5 h-6 w-3"
              />
            ) : null}
          </span>
        </div>
      ) : null}
    </>
  );
}

/**
 * C — 레일 오른쪽 거터(136px). 회의 중에 묻는 장면에서만. 손글씨 「답 아래엔 참고한 회의록이 붙어요」는
 * 「참고한 회의록 N개」 줄을 **재서** 가리킨다(`useMarkEdges(railMark)` 의 `--mt` · `--mb`) — 화살 끝이 그 줄의
 * 가운데 높이에서 레일 오른쪽 여백(16px)에 닿고 멈춘다. 그 줄이 대화창의 보이는 칸 안에 없으면(입력창 밑)
 * 손글씨는 숨고 흰 쪽지만 선다(`--mvis`). 예전에는 창 500 기준의 고정 자리(176 · 256)라, 낮은 창(1366×650 의
 * 레일 321)에서 화살표가 입력창의 범위 칩 「3차 스프린트 킥오프」를 가리켜 그 칩이 「참고한 회의록」처럼 읽혔다.
 *
 * 흰 쪽지는 질문 옆에 선다 — 높이 890 이하는 대화 제목 줄이 빠져(`hero-rail.tsx`) 질문이 57px 올라가므로 119,
 * 720 이하는 답이 다 흐르면 대화창이 참고 줄까지 굴러 손글씨가 창 위쪽(약 130)으로 오므로 48 이다(두 단은 높이
 * 범위로 가른다 — `WINDOW_H` 주석). 쪽지와 손글씨는 **창 밖**(레일 오른쪽 끝 + 8 · 16)에 선다 — 안쪽으로
 * 걸쳤더니 기울어진 쪽지 모서리가 흐르는 답의 줄 끝 글자를 덮었다. 오른쪽 끝은 무대 끝(거터 136) 안이다.
 */
function RailNotes({ scene, askDone }: { scene: Scene; askDone: boolean }) {
  if (scene !== "ask") return null;
  return (
    <>
      <div
        aria-hidden
        className="absolute top-[176px] left-full ml-2 hidden w-[124px] xl:block [@media(max-height:720px)]:top-12 [@media(min-height:721px)_and_(max-height:890px)]:top-[119px]"
      >
        <Sticky tone="white" tilt={3} anim="pop" className="block">
          회의 중에 몰래 물어봐도 돼요
        </Sticky>
      </div>
      {askDone ? (
        <div
          aria-hidden
          className="absolute left-full ml-4 hidden w-[116px] [visibility:var(--mvis,visible)] xl:block"
          style={{ top: "calc((var(--mt, 293px) + var(--mb, 321px)) / 2 - 52px)" }}
        >
          <Hand className="tv-pop block text-[13px] break-keep">답 아래엔 참고한 회의록이 붙어요</Hand>
          <Scribble
            kind="arrow"
            flipX
            draw="mount"
            delay={250}
            rotate={-40}
            className="absolute -bottom-6 -left-8 h-7 w-10"
          />
        </div>
      ) : null}
    </>
  );
}

/**
 * 데스크톱 창 높이(노트 · 레일 같이). 1440×900 은 500. 낮은 화면은 창 바닥이 보이는 높이 8px 위에 오도록
 * 줄인다 — 721~890 은 `100svh − 355`, 720 이하는 제목이 줄어 `100svh − 329`(계산은 머리 주석). 두 단은
 * **높이 범위로 가른다** — 둘 다 `max-height` 로 두면 Tailwind 가 720 단을 먼저 내보내 890 단이 이긴다.
 * 예전 최솟값 400 은 1366×650 에서 창 바닥을 93px 밖으로 밀었다. 따라가는 탭 · 검토 문서는 `clientHeight` 를
 * 재므로 그대로 따라온다.
 */
const WINDOW_H =
  "lg:h-[500px] lg:[@media(min-height:721px)_and_(max-height:890px)]:h-[clamp(360px,calc(100svh-355px),500px)] lg:[@media(max-height:720px)]:h-[clamp(300px,calc(100svh-329px),500px)]";

/**
 * 장 줄 — 그림이다(뜻은 figcaption). 눌리는 세그먼트처럼 보이지 않게 바탕 · 테두리 없이 점과 글자만
 * 둔다. 지난 장은 보라 점, 지금 장은 노란 점 + 먹색 굵은 글자, 남은 장은 옅은 점.
 */
function Chapters({ chapter }: { chapter: number }) {
  const dot = (i: number) =>
    cn(
      "size-2 shrink-0 rounded-full transition-colors duration-300",
      i < chapter
        ? "bg-[var(--tv-brand)]"
        : i === chapter
          ? "bg-[var(--tv-pop)] ring-2 ring-[var(--tv-ink)]"
          : "bg-[var(--tv-rule-strong)]"
    );
  return (
    <div aria-hidden className="relative mt-5 flex items-center justify-center lg:mt-8 xl:mt-12">
      <span className="hidden items-center gap-2 lg:flex">
        {CHAPTERS.map((name, i) => (
          <Fragment key={name}>
            {i > 0 ? <span className="h-px w-5 bg-[var(--tv-rule-strong)]" /> : null}
            <span
              className={cn(
                "inline-flex items-center gap-2 text-[13px] transition-colors duration-300",
                i === chapter
                  ? "font-extrabold text-[var(--tv-ink)]"
                  : "font-semibold text-[var(--tv-muted)]"
              )}
            >
              <span className={dot(i)} />
              {name}
            </span>
          </Fragment>
        ))}
      </span>
      <span className="flex items-center gap-1.5 lg:hidden">
        {CHAPTERS.map((name, i) => (
          <span key={name} className={dot(i)} />
        ))}
        <span className="ml-2 text-[13px] font-extrabold text-[var(--tv-ink)]">
          {CHAPTERS[chapter]}
        </span>
      </span>
    </div>
  );
}

export function HeroStage() {
  const [visible, seen, attach] = useInView();
  /**
   * 노트 창이 충분히 화면에 들어왔나(한 번). 감시 점은 넓은 화면은 창 위끝에서 창 높이의 25%, 좁은 화면은
   * **창 위끝에서 64px**(상단바 + 탭 글자) 아래다. 좁은 화면을 75% 로 두었을 때는 실제 휴대폰 브라우저의 보이는
   * 높이(390×664 아이폰 Safari · 375×553 SE · 360×660)에서 그 점이 첫 화면 밖이라, 자막만 「받아 적는 중」을
   * 말하고 창은 서 있었다(390×844 처럼 기기 화면 크기로 재서 통과했던 것이다). 첫 화면에서 보이는 것이 처음의
   * 움직임이어야 한다. 64 면 창 머리가 보이자마자 돌아 첫 화면에서 탭이 바뀌고 자막이 갈린다. 대신 짧은 화면에서는
   * 받아 적는 줄(창 아래쪽, 독 위)이 첫 바퀴에 화면 밖에서 지나간다 — 바퀴가 돌아오므로 내려 보면 다시 본다.
   * 넓은 화면은 창이 첫 화면에 들어 25% 로 충분하다.
   */
  const [watchNote, noteSeen] = useOnceInView<HTMLSpanElement>({
    threshold: 0,
    rootMargin: "0px 0px -16px 0px",
  });
  /**
   * 첫 바퀴는 0.8초 늦게 시작한다 — 창이 들어오는 등장 애니메이션과 첫 장면(받아 적기)이 겹치면 둘 다 안
   * 읽힌다. 되돌아 도는 둘째 바퀴부터는 기다리지 않는다(한 번 켜지면 계속 참).
   */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!seen || !noteSeen || armed) return;
    const id = window.setTimeout(() => setArmed(true), 800);
    return () => window.clearTimeout(id);
  }, [seen, noteSeen, armed]);
  const noteRef = useMarkEdges(noteMark);
  const railRef = useMarkEdges(railMark);

  /**
   * 붙잡기 — `HOLD_MS` 의 순간(`Moment`)에 들어서면 그만큼 대본을 쉬게 한다(쪽지를 읽을 틈). use-demo 는
   * 손대지 않고 `visible` 만 거짓으로 넘긴다. 순간이 바뀌는 것은 렌더 중에 알아채고 바로 붙잡는다 — 효과에서
   * 하면 대본의 다음 박자가 한 번 예약된 뒤에야 선다.
   */
  const [held, setHeld] = useState<Moment | null>(null);
  const [lastMoment, setLastMoment] = useState<Moment>("listen");
  const demo = useDemo({ visible: visible && armed && held === null, seen });
  const scene = sceneOf(demo);
  /** 물어보기 장면에서 답이 다 흘렀나. 대본은 다 흐른 뒤에도 진행값을 쥔 채 머문다(`HOLD.ask`). */
  const streaming =
    demo.typing !== null &&
    demo.typingAt >= 0 &&
    demo.typing < (demo.turns[demo.typingAt]?.a.length ?? 0);
  const askDone = scene === "ask" && !streaming;
  /** 받아 적는 말이 다 적혔나(확정 직전, `HOLD.say` 동안). */
  const typed = demo.live !== null && demo.live.text.length === demo.live.line.text.length;
  const moment: Moment = askDone
    ? "answered"
    : typed && scene === "listen"
      ? "typed"
      : typed && scene === "task"
        ? "asked"
        : typed && scene === "open"
          ? "idle"
          : scene;
  if (moment !== lastMoment) {
    setLastMoment(moment);
    setHeld(HOLD_MS[moment] ? moment : null);
  }
  useEffect(() => {
    if (held === null) return;
    // 답 밑 손글씨는 xl 에만 선다 — 좁은 화면은 레일이 첫 화면 밖이라 다 붙잡으면 노트 창만 멈춰 서 있다.
    // 좁은 화면은 자막(「회의 중에 몰래 물어보기 ↓」)이 3초를 넘길 만큼만 붙잡는다(`ANSWERED_NARROW_MS`).
    const narrow = held === "answered" && !window.matchMedia("(min-width: 1280px)").matches;
    const id = window.setTimeout(() => setHeld(null), narrow ? ANSWERED_NARROW_MS : HOLD_MS[held]);
    return () => window.clearTimeout(id);
  }, [held]);

  const want = SCENE_TAB[scene];
  /** 방문자가 다른 탭을 고정해 두었으면 그 장면의 노트 본문용 주석은 가리킬 것이 없다. */
  const tabOk = !want || want === demo.noteTab;
  const chapter = CHAPTER_OF[scene];
  const uid = useId();
  const capId = `${uid}-cap`;
  const PlayIcon = demo.paused ? Play : Pause;
  const caption = CAPTION[scene];
  /**
   * 모션을 줄였으면 대본이 안 돌고 마지막 화면 한 장이다 — 일시정지 버튼도 숨는다(`motion-reduce:hidden`).
   * 그때 캡션은 「다시 돌아갑니다 · 일시정지 버튼」을 말하지 않고 그 정지 화면만 설명한다.
   */
  const still = useReducedMotion();

  return (
    <figure
      aria-labelledby={capId}
      className={cn(
        STAGE_WRAP,
        "relative mt-6 max-lg:[@media(max-height:700px)]:mt-4 lg:mt-8 lg:[@media(max-height:890px)]:mt-3"
      )}
    >
      <figcaption id={capId} className="sr-only">
        {still
          ? "예시 회의 3차 스프린트 킥오프를 끝낸 뒤의 요약 탭 화면입니다. 결정 둘과 할 일 둘이 정리되어 있고, 아래에 검토 완료 막대가 서 있습니다."
          : "예시 회의 3차 스프린트 킥오프 화면입니다. 말이 스크립트에 받아 적히고, 타임라인에 할 일과 질문이 붙고, 내 에이전트에게 묻고, 중지한 뒤 회의를 끝내면 요약 탭에 검토 완료 막대가 서기까지를 한 번 보여 주고 처음부터 다시 돌아갑니다. 위의 일시정지 버튼으로 멈출 수 있습니다."}
      </figcaption>

      {/* 무대 뒤 장식 원 둘 — 무대 모서리 밖으로 반쯤 삐져나온 조각만 보인다. 버터 원의 위끝은 무대 위
          여백만큼만 올라간다(제목 밑으로 파고들지 않게). */}
      <span
        aria-hidden
        className="absolute -top-8 -left-8 hidden size-[240px] rounded-full bg-[var(--tv-butter)] lg:block lg:[@media(max-height:890px)]:-top-3"
      />
      <span
        aria-hidden
        className="absolute -right-4 -bottom-10 hidden size-[200px] rounded-full bg-[var(--tv-mint)] lg:block"
      />

      <div
        ref={attach}
        data-paused={demo.paused || undefined}
        className="tv-rise relative z-10 px-4 pt-14 max-lg:[@media(max-height:600px)]:pt-12 lg:rounded-[40px] lg:bg-[var(--tv-lav)] lg:px-8 lg:pb-6 xl:px-0"
      >
        {/* 모바일: 색 면은 창 위끝까지만(띠 56 + 창이 덮는 8 = 64) — **창 옆에 평행한 색 띠를 두지 않는다.**
            아래 모서리 반지름 40 은 창 왼쪽 끝(x 16)에서 정확히 창 위끝(56)에 닿는다 — 거터의 라벤더가 창
            위끝선보다 위에서 끝나고, 곧은 아랫변은 창 뒤에 숨는다. 창 머리 아래(156)까지 깔았을 때는 16px 띠가
            창 가장자리와 나란히 100px 서서 테두리로 읽혔다. 위 모서리 바깥으로 버터 · 민트 원 조각이 걸친다
            (데스크톱 무대의 원과 같은 말). 걸치는 만큼(12 · 8px)은 위 버튼과의 틈(24px, 높이 700 이하 16px)
            안이다 — 원이 무대와 함께 버튼보다 위에 그려져서, 더 걸치면 버튼 아래 모서리를 덮는다.
            높이 600 이하(375×553 SE)는 띠를 8px 줄인다(56 → 48, 색 면 64 → 56, 띠 안 줄은 위 12 → 8) — 창이 덮는
            8px 과 반지름 40 이 창 위끝에 닿는 셈은 그대로다(`hero.tsx` 머리 주석의 375×553 셈). */}
        <span
          aria-hidden
          className="absolute -top-3 left-3 size-[76px] rounded-full bg-[var(--tv-butter)] lg:hidden"
        />
        <span
          aria-hidden
          className="absolute -top-2 right-5 size-[56px] rounded-full bg-[var(--tv-mint)] lg:hidden"
        />
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-16 rounded-b-[40px] bg-[var(--tv-lav)] [@media(max-height:600px)]:h-14 lg:hidden"
        />

        {/* 위 띠 — 「예시 회의」 테이프, 일시정지, 거터가 없는 화면의 장면 자막. */}
        <div className="absolute inset-x-4 top-3 max-lg:[@media(max-height:600px)]:top-2 lg:inset-x-8 xl:inset-x-0">
          <div className="mx-auto flex max-w-[960px] items-start gap-2.5">
            <span className="tv-pop -ml-1 inline-flex" style={vars({ "--d": "700ms" })}>
              <Tape>예시 회의</Tape>
            </span>
            {/* 보이는 크기는 36px, 누름 칸은 44px(`before:-inset-1`, 엄지 기준). */}
            <button
              type="button"
              onClick={demo.togglePaused}
              className={cn(
                "relative inline-flex size-9 shrink-0 before:absolute before:-inset-1 before:rounded-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white text-[13px] font-bold text-[var(--tv-ink)] shadow-[0_2px_6px_-2px_rgba(28,24,69,0.3)] transition-colors hover:bg-[var(--tv-butter-soft)] motion-reduce:hidden lg:w-auto lg:pr-3.5 lg:pl-3",
                FOCUS
              )}
            >
              <PlayIcon aria-hidden className="size-4" />
              <span className="sr-only lg:not-sr-only">{demo.paused ? "재생" : "일시정지"}</span>
            </button>
            {tabOk && armed ? (
              // 「답 못 한 질문도 남겨요」는 그 질문 줄이 창에 다 든 뒤에 선다(`ROW_IN_MS`). 자막은 대본이 돌기
              // 시작한 뒤(`armed`)에만 선다 — 창이 아직 서 있는데 「받아 적는 중」이라 말하지 않게.
              <Sticky
                key={caption}
                tone="pop"
                size="sm"
                tilt={2}
                anim="pop"
                delay={scene === "open" ? ROW_IN_MS : 0}
                className="-mt-1 ml-auto shrink-0 xl:hidden"
              >
                {caption}
                {/* 가리킬 것이 첫 화면 밖일 수 있는 장면 — 레일(창 아래, 넓으면 오른쪽), 독 · 검토 막대(늘 창 바닥,
                    짧은 휴대폰 높이에서는 첫 화면 밖). */}
                {scene === "ask" ? (
                  <>
                    <span className="lg:hidden"> ↓</span>
                    <span className="hidden lg:inline"> →</span>
                  </>
                ) : scene === "stop" || scene === "confirm" ? (
                  <span className="lg:hidden"> ↓</span>
                ) : null}
              </Sticky>
            ) : null}
          </div>
        </div>

        <div className="relative mx-auto flex max-w-[960px] flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
          {/* `--a` — 거터 위쪽 쪽지(범례 · 받아 적기 장면의 회의실 말풍선)의 위끝. 창이 낮으면 올린다. */}
          <div
            ref={noteRef}
            className="relative min-w-0 [--a:118px] lg:flex-1 lg:[@media(min-height:721px)_and_(max-height:890px)]:[--a:76px] lg:[@media(max-height:720px)]:[--a:16px]"
          >
            {/* 감시 점 — 좁은 화면은 창 위끝 + 64(탭 줄), 넓은 화면은 4분의 1 줄. */}
            <span
              ref={watchNote}
              aria-hidden
              className="pointer-events-none absolute inset-x-0 h-px max-lg:top-16 lg:top-1/4"
            />
            <AppWindow
              className={cn("tv-rise flex h-[clamp(340px,calc(100svh-480px),440px)] flex-col", WINDOW_H)}
              style={vars({ "--i": 1 })}
            >
              <HeroNote demo={demo} scene={scene} holding={held !== null} uid={uid} />
            </AppWindow>
            <NoteNotes demo={demo} scene={scene} tabOk={tabOk} />
          </div>
          <div ref={railRef} className="relative lg:w-[312px] lg:shrink-0">
            <AppWindow
              className={cn("tv-rise flex h-[380px] flex-col", WINDOW_H)}
              style={vars({ "--i": 2 })}
            >
              <HeroRail demo={demo} asking={scene === "ask"} />
            </AppWindow>
            <RailNotes scene={scene} askDone={askDone} />
          </div>
        </div>

        <Chapters chapter={chapter} />
      </div>
    </figure>
  );
}
