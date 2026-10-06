import type { ReactNode } from "react";
import { MousePointer2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { Face } from "./app";
import { HAND, SHADOW, vars } from "./tokens";

/*
 * 주석 키트 — 페이지가 하는 말. **창 안 = `--el-*` · `APP` · `ROLE_*`, 창 밖 · 창 위 주석 = `--tv-*`.**
 * 여기 있는 것은 전부 `--tv-*` 이고, 창 위에 얹을 때도 앱 글자 · 상태 칩 · 탭 · 버튼 · 방금 붙은 줄을
 * 가리지 않는다(창 가장자리 여백까지만 걸친다).
 *
 * 장식 문법은 셋으로 고정한다 — ① 노란/파스텔 쪽지(`Sticky`) = 「여기 봐」, ② 점선 「예시」 도장
 * (`ExampleStamp`) = 지어낸 것, ③ 먹색 손글씨(`Hand`) + 보라 곡선(`Scribble`) = 설명. 한 그림에 쪽지는
 * 동시에 최대 둘.
 *
 * 서버 · 클라이언트 양쪽에서 쓴다(훅 없음). 움직임은 `motion.tsx` 의 클래스가 하고, 모션을 줄이면
 * 처음부터 끝 상태(다 보이고 다 그려진)로 선다.
 */

type Anim = "none" | "pop" | "reveal";

/** 마운트 때 튀어나오기(`tv-pop`) / 조상 `Reveal` 이 보일 때 튀어나오기(`tv-rpop`). */
const POP: Record<Anim, string | undefined> = {
  none: undefined,
  pop: "tv-pop",
  reveal: "tv-rpop",
};

const STICKY_TONE = {
  pop: "bg-[var(--tv-pop)]",
  butter: "bg-[var(--tv-butter)]",
  mint: "bg-[var(--tv-mint)]",
  lav: "bg-[var(--tv-lav)]",
  peach: "bg-[var(--tv-peach)]",
  white: "bg-white border-[1.5px] border-[var(--tv-ink)]",
} as const;

const STICKY_SIZE = {
  sm: "px-3 py-2 text-[13px]",
  md: "px-3 py-2 text-[14.5px]",
  lg: "px-4 py-2.5 text-[17px]",
} as const;

/**
 * 쪽지 — 「여기 봐」. 기울임 ±2~5°, 쪽지 그림자, 굵은 먹색 글자, 가끔 테이프.
 * 기울기는 `rotate` 속성(인라인)이라 등장 애니메이션(scale · translate · opacity)과 겹치지 않는다.
 * 기본은 `aria-hidden` — 뜻이 있는 말이면 `aria-hidden={false}` 로 읽히게 하거나 sr-only 캡션을 따로 둔다.
 * 위치는 `className`(absolute 등)으로 준다.
 */
export function Sticky({
  tone = "pop",
  tilt = -3,
  size = "md",
  tape = false,
  anim = "none",
  delay = 0,
  "aria-hidden": ariaHidden = true,
  className,
  children,
}: {
  tone?: keyof typeof STICKY_TONE;
  tilt?: number;
  size?: keyof typeof STICKY_SIZE;
  tape?: boolean;
  anim?: Anim;
  delay?: number;
  "aria-hidden"?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden={ariaHidden || undefined}
      className={cn(
        "relative inline-block rounded-[10px] leading-[1.3] font-extrabold break-keep text-[var(--tv-ink)]",
        STICKY_TONE[tone],
        STICKY_SIZE[size],
        SHADOW.sticky,
        POP[anim],
        className
      )}
      style={{ rotate: `${tilt}deg`, ...vars({ "--d": `${delay}ms` }) }}
    >
      {tape ? (
        <span
          aria-hidden
          className="absolute -top-2 left-1/2 h-3 w-8 -translate-x-1/2 -rotate-[4deg] bg-white/70"
        />
      ) : null}
      {children}
    </span>
  );
}

type ScribbleKind =
  | "arrow"
  | "arrow-long"
  | "arrow-down"
  | "circle"
  | "underline"
  | "strike"
  | "chevrons";

/**
 * 손으로 그린 선의 모양. `lines` 가 먼저 그려지고 `heads`(화살촉)가 뒤따른다. `stretch` 인 것은
 * 크기에 맞춰 늘어난다(동그라미 · 밑줄 · 취소선). 화살촉은 끝 접선에서 ±35° 로 계산한 자리다.
 */
const SHAPES: Record<
  ScribbleKind,
  { w: number; h: number; stretch?: boolean; lines: string[]; heads?: string[] }
> = {
  arrow: {
    w: 64,
    h: 40,
    lines: ["M4 32 C 18 34, 38 28, 54 12"],
    heads: ["M43 14 L54 12 L52 23"],
  },
  "arrow-long": {
    w: 140,
    h: 60,
    lines: ["M6 48 C 34 60, 58 40, 70 30 S 104 4, 132 14"],
    heads: ["M124.5 4.6 L132 14 L120.3 16.6"],
  },
  "arrow-down": {
    w: 30,
    h: 56,
    lines: ["M16 4 C 6 18, 24 32, 14 50"],
    heads: ["M23 45.6 L14 50 L13 40"],
  },
  circle: {
    w: 120,
    h: 48,
    stretch: true,
    lines: [
      "M70 6 C 30 2, 4 14, 6 26 C 8 40, 50 46, 82 42 C 110 38, 118 24, 108 14 C 98 4, 66 3, 44 8",
    ],
  },
  underline: {
    w: 120,
    h: 12,
    stretch: true,
    lines: ["M2 8 C 20 2, 34 12, 52 6 S 86 2, 102 7 S 114 9, 118 5"],
  },
  strike: { w: 120, h: 10, stretch: true, lines: ["M3 6 C 30 3, 70 7, 117 4"] },
  chevrons: {
    w: 48,
    h: 20,
    lines: ["M4 4 L12 10 L4 16", "M18 4 L26 10 L18 16", "M32 4 L40 10 L32 16"],
  },
};

const INK = {
  brand: "text-[var(--tv-brand)]",
  ink: "text-[var(--tv-ink)]",
  pop: "text-[var(--tv-pop)]",
  white: "text-white",
} as const;

/**
 * 손으로 그린 선 — 화살표 · 동그라미 · 밑줄 · 취소선 · `>>>`. 기본 크기는 모양의 viewBox 그대로이고
 * `className`(w-/h-/absolute)으로 바꾼다. `draw="mount"` 면 붙자마자, `"reveal"` 이면 조상 `Reveal` 이
 * 보일 때 그려진다(화살촉은 몸통 뒤 420ms). 모션을 줄이면 처음부터 다 그려져 있다.
 */
export function Scribble({
  kind,
  color = "brand",
  draw = false,
  delay = 0,
  flipX = false,
  rotate = 0,
  className,
}: {
  kind: ScribbleKind;
  color?: keyof typeof INK;
  draw?: false | "mount" | "reveal";
  delay?: number;
  flipX?: boolean;
  rotate?: number;
  className?: string;
}) {
  const shape = SHAPES[kind];
  const drawClass = draw === "mount" ? "tv-draw" : draw === "reveal" ? "tv-rdraw" : undefined;
  const path = (d: string, wait: number) => (
    <path
      key={d}
      d={d}
      pathLength={1}
      className={drawClass}
      style={vars({ "--d": `${delay + wait}ms` })}
    />
  );
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${shape.w} ${shape.h}`}
      width={shape.w}
      height={shape.h}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      preserveAspectRatio={shape.stretch ? "none" : undefined}
      className={cn("pointer-events-none shrink-0 overflow-visible", INK[color], className)}
      style={{
        rotate: rotate ? `${rotate}deg` : undefined,
        scale: flipX ? "-1 1" : undefined,
      }}
    >
      {shape.lines.map((d, i) => path(d, kind === "chevrons" ? i * 120 : 0))}
      {shape.heads?.map((d) => path(d, 420))}
    </svg>
  );
}

/**
 * 손가락 커서 — 창 위 주석. 가리킬 요소 안에 `absolute` 로 넣는다(좌표 계산 없음). 기본 자리는
 * `left-[60%] top-[55%]`, `className` 으로 덮어쓴다. 붙을 때 미끄러져 들어오고(`tv-glide` .45s),
 * `press` 면 그 뒤 화살 끝에서 노란 고리가 퍼진다(지연 = 450ms + `delay`). 모션을 줄이면 숨는다.
 */
export function Cursor({
  press = false,
  delay = 0,
  className,
}: {
  press?: boolean;
  delay?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "tv-glide pointer-events-none absolute top-[55%] left-[60%] z-40 motion-reduce:hidden",
        className
      )}
    >
      {press ? (
        <span
          className="tv-ripple absolute -top-2.5 -left-2.5 size-7 rounded-full border-2 border-[var(--tv-pop)]"
          style={vars({ "--d": `${450 + delay}ms` })}
        />
      ) : null}
      <MousePointer2
        className="relative block size-[22px] fill-[var(--tv-ink)] stroke-white"
        strokeWidth={1.5}
      />
    </span>
  );
}

/** 「예시」 도장 — 지어낸 회의 · 사람 · 날짜에 붙는다. **실제 글자다**(읽힌다). */
export function ExampleStamp({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-[8px] border-2 border-dashed border-[var(--tv-ink)]/55 bg-white/80 px-2 text-[12px] font-extrabold tracking-[0.06em] text-[var(--tv-ink)]",
        className
      )}
      style={{ rotate: "-3deg" }}
    >
      예시
    </span>
  );
}

/** 히어로의 「예시 회의」 띠. 양 끝을 노란 테이프로 붙인 흰 종이 띠다. **실제 글자다.** */
export function Tape({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 items-center bg-white/85 px-3.5 text-[13px] font-extrabold whitespace-nowrap text-[var(--tv-ink)]",
        SHADOW.sticky,
        className
      )}
      style={{ rotate: "-3deg" }}
    >
      <span
        aria-hidden
        className="absolute top-[5px] -left-[7px] h-[22px] w-3.5 bg-[var(--tv-pop)]/60"
        style={{ rotate: "8deg" }}
      />
      {children}
      <span
        aria-hidden
        className="absolute top-[5px] -right-[7px] h-[22px] w-3.5 bg-[var(--tv-pop)]/60"
        style={{ rotate: "-8deg" }}
      />
    </span>
  );
}

const SPEECH_TONE = {
  butter: "bg-[var(--tv-butter)]",
  pop: "bg-[var(--tv-pop)]",
  white: "bg-white border-[1.5px] border-[var(--tv-ink)]",
} as const;

/**
 * 얼굴 + 말풍선 — 페이지의 농담(「이번 주 회의록 당번 누구예요?」). 얼굴 쪽 아래 모서리만 뾰족하다.
 * 앱의 대화 말풍선(`UserBubble`, 꼬리 없음)과 다른 페이지 장식이라 창 밖에만 둔다. 글자는 읽힌다.
 */
export function Speech({
  who,
  side = "left",
  tone = "butter",
  size = "md",
  tilt = 0,
  anim = "none",
  delay = 0,
  className,
  children,
}: {
  who: string;
  side?: "left" | "right";
  tone?: keyof typeof SPEECH_TONE;
  size?: "md" | "sm";
  tilt?: number;
  anim?: Anim;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-end gap-2",
        side === "right" && "flex-row-reverse",
        POP[anim],
        className
      )}
      style={{ rotate: tilt ? `${tilt}deg` : undefined, ...vars({ "--d": `${delay}ms` }) }}
    >
      <Face who={who} size={size === "md" ? 32 : 28} className="shrink-0" />
      <span
        className={cn(
          "rounded-[18px] px-4 py-2 leading-[1.4] font-bold break-keep text-[var(--tv-ink)]",
          size === "md" ? "text-[15px]" : "text-[13px]",
          side === "right" ? "rounded-br-[4px]" : "rounded-bl-[4px]",
          SPEECH_TONE[tone]
        )}
      >
        {children}
      </span>
    </span>
  );
}

/** 먹색 손글씨 주석(살짝 기울임). 기본 `aria-hidden` — 뜻이 있는 말이면 끄거나 sr-only 로 따로 남긴다. */
export function Hand({
  "aria-hidden": ariaHidden = true,
  className,
  children,
}: {
  "aria-hidden"?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden={ariaHidden || undefined}
      className={cn("inline-block", HAND, className)}
      style={{ rotate: "-2deg" }}
    >
      {children}
    </span>
  );
}
