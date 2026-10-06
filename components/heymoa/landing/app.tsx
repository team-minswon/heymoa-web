import type { HTMLAttributes, ReactNode } from "react";
import {
  ArrowUp,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Folder,
  History,
  PanelRightClose,
  Pause,
  Plus,
  Sparkles,
  Square,
  Users,
} from "lucide-react";

import { FACE_KEY } from "@/components/heymoa/landing/shell";
import type { NoteTab, Status } from "@/components/heymoa/landing/use-demo";
import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import { scopeChipClass } from "@/lib/chat/scope-chip";
import type { TimelineTone } from "@/lib/notes/proposals/timeline";
import { unnamedSpeakerAvatarKey } from "@/lib/people/avatar-key";
import { cn } from "@/lib/utils";

import { APP, RADIUS, ROLE_TEXT, SHADOW, TONE_TITLE } from "./tokens";

/*
 * 앱 화면 조각. **창 안 = `--el-*` · `APP` · `ROLE_*` 만, 창 밖 · 창 위 주석 = `--tv-*`(`marks.tsx`).**
 *
 * - 서버 · 클라이언트 양쪽에서 쓴다 — 훅이 없고, 전부 `<span>`/`<div>` 그림이라 포커스가 가지 않는다.
 *   진짜로 눌리는 것은 구간이 `<button>` 으로 따로 만든다(펼치기는 `app-client.tsx`).
 * - 값은 괄호 안 앱 컴포넌트의 클래스를 다시 읽고 맞췄다. **크기 prop 이 없는 것은 앱 값 그대로다** —
 *   키울 때는 구간이 창 본문에 `[zoom:1.05]` 처럼 균일 확대를 건다(0.95~1.1).
 * - 앱과 다른 곳은 넷이다. ① 앱이 말줄임(`truncate`)하는 줄 내용을 여기서는 줄바꿈해 다 보인다(과장 허용).
 *   ② 앱이 `--el-muted-soft`(흰 바탕 2.5:1)로 쓰는 **글자**(시각 · 개수 · 주제 · 레일 부제 · 「담당 정하기」 ·
 *   철회 · 제외 줄 · 빈 상태 문구)를 한 단 진한 앱 토큰 `APP.muted`(4.8:1)로 올렸다. 「몇 분에 누가 한 말인지」가
 *   이 페이지가 파는 정보라 읽혀야 한다(가독성 손보기 허용 범위). 점 · 선 · 아이콘은 앱처럼 `APP.faint` 그대로다.
 *   ③ **테두리는 한 겹(사용자: 「테두리가 2개인 건 이상하다」).** 잘라 보인 창 · 카드에서는 앱의 줄 선 · 상자가
 *   프레임과 나란히 서서 두 겹으로 읽힌다. 그래서 마지막 줄의 아래 선을 지우고(`ROW_LINE`), 좁은 화면의 근거
 *   상자는 선 상자 대신 왼쪽 세로선으로 서고(`EvidenceQuotes`), 확정 막대는 창 폭에 맞는 모양을 고른다(`ConfirmBar`).
 *   ④ 화면 읽기 프로그램용 구분(`Dots` 의 sr-only 쉼표) — 그림 글자가 「결정철회됨」처럼 붙어 읽히지 않게.
 * - 앱에 없는 버튼 · 칩 · 라벨을 여기 더하지 않는다. 필요하면 창 밖 주석으로 말한다.
 */

/* ── 얼굴 ─────────────────────────────────────────────────────────────── */

/**
 * 얼굴 열쇠. 앞의 넷은 기존 랜딩과 같은 사람(`landing/shell.tsx`)이고, 나머지는 이 페이지의 예시
 * 회의가 지어낸 사람이다. 이름이 아니라 변하지 않는 식별자를 넘기는 것은 앱의 `personAvatarKey` 규칙.
 */
const FACE: Record<string, string> = {
  ...FACE_KEY,
  한서진: "landing:tldv:han-seojin",
  오태윤: "landing:tldv:oh-taeyun",
  윤하린: "landing:tldv:yoon-harin",
  문지호: "landing:tldv:moon-jiho",
  송다온: "landing:tldv:song-daon",
};

/** 이름이 붙은 사람의 얼굴(`PersonAvatar`). */
export function Face({
  who,
  size = 20,
  className,
}: {
  who: string;
  size?: number;
  className?: string;
}) {
  return <PersonAvatar name={FACE[who] ?? who} size={size} className={className} />;
}

/** 아직 이름이 안 붙은 화자의 얼굴. `label` 은 「A」 같은 화자 라벨(`unnamedSpeakerAvatarKey`). */
export function SpeakerFace({
  label,
  size = 20,
  className,
}: {
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <PersonAvatar
      name={unnamedSpeakerAvatarKey(label)}
      size={size}
      className={className}
    />
  );
}

/**
 * 겹친 얼굴(`review-head.tsx` 참석자 칩). 5px 씩 겹치고 1.5px 테를 두른다. `ring` 은 테 색 클래스 —
 * 창 안은 흰색 그대로, 창 밖 색 면 위에 둘 때만 그 면 색을 준다(예: `ring-[var(--tv-lav)]`).
 */
export function FacePile({
  names,
  size = 22,
  ring = "ring-white",
  className,
}: {
  names: string[];
  size?: number;
  ring?: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("flex shrink-0", className)}>
      {names.map((name, i) => (
        <Face
          key={name}
          who={name}
          size={size}
          className={cn("ring-[1.5px]", ring, i > 0 && "-ml-[5px]")}
        />
      ))}
    </span>
  );
}

/* ── 창 ───────────────────────────────────────────────────────────────── */

/**
 * 앱 창 하나. 흰 바탕 · 16 모서리 · 그림자 하나 — **테두리 선이 없다**(색 면 위에서도 흰 면 위에서도).
 * 또 다른 흰 상자 · 매트로 감싸지 않는다. 창 안 기본 글자색은 앱 먹색이다.
 * 확정 막대처럼 창 바닥 가장자리에 반쯤 걸칠 것은 창 밖 형제로 두거나 `className="overflow-visible"` 을
 * 넘긴다(창 안 면이 모서리 밖으로 비어져 나오지 않는지 같이 본다).
 */
export function AppWindow({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: "div" | "figure" | "section" | "article";
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        "relative overflow-hidden bg-white text-left",
        APP.ink,
        RADIUS.window,
        SHADOW.panel,
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ── 노트 상단바 ──────────────────────────────────────────────────────── */

const TABS: readonly NoteTab[] = ["정보", "스크립트", "타임라인", "요약"];

/**
 * 회의 상태 칩(`meeting-controls.tsx` `MeetingStatusChip`). 바탕 없이 점 + 글자 11px. 기록 중만
 * 붉고, 중지됨은 ⏸ 아이콘, 종료됨은 회색 점이다.
 */
export function StatusChip({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const live = status === "기록 중";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-[11px] font-semibold",
        live ? APP.rec : APP.muted,
        className
      )}
    >
      {status === "중지됨" ? (
        <Pause aria-hidden className="size-3.5" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            live ? APP.recBg : "bg-[var(--el-muted)]"
          )}
        />
      )}
      {status}
    </span>
  );
}

/**
 * 노트 탭 넷의 그림(`note-panel.tsx` `TAB_ITEM` · `tabs.tsx` line 변형). 순서는 늘 정보 · 스크립트 ·
 * 타임라인 · 요약이고, 지금 탭만 먹색 + 2px 먹색 밑줄, 나머지는 먹색 60%. 무게는 둘 다 medium.
 * 앱 글자는 12px — `md` 는 한 단 키운 13px 이다. 그림이라 `aria-hidden` 이고 지금 탭 이름만 읽힌다.
 * 진짜로 눌리는 탭(히어로)은 구간이 이 모양을 따라 `<button role="tab">` 으로 만든다.
 */
function TabStrip({
  active,
  size = "md",
  className,
}: {
  active: NoteTab;
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <span className={cn("flex items-stretch", className)}>
      <span className="sr-only">{`${active} 탭`}</span>
      <span
        aria-hidden
        className={cn("flex items-stretch", size === "sm" ? "gap-4" : "gap-5")}
      >
        {TABS.map((tab) => (
          <span
            key={tab}
            className={cn(
              "relative flex items-center font-medium whitespace-nowrap",
              size === "sm" ? "text-[12px]" : "text-[13px]",
              tab === active ? APP.ink : "text-[var(--el-ink)]/60"
            )}
          >
            {tab}
            {tab === active ? (
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--el-ink)]" />
            ) : null}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * 노트 상단바 축소판(`note-panel.tsx` `note-top-bar`). `상태 칩 · 제목 … 탭 넷`. 앱의 ← · ⤡ 와 탭 뒤
 * 「회의 종료」 · 「…」는 잘라 보이기로 생략한다. 탭 줄은 바 높이를 채우고 밑줄이 바의 hairline 위에
 * 앉는다(앱과 같다).
 *
 * 창이 좁아 상태 칩(+ 제목)과 탭 넷이 한 줄에 안 들어가면 탭 줄이 저절로 둘째 줄로 내려간다 — 앱의
 * 모바일 상단바(히어로 모바일)와 같은 배치다. 칩 칸이 `flex-auto`(바탕 크기 = 칩 폭)라 겹치기 전에
 * 줄이 바뀌고, 문턱 숫자를 따로 두지 않는다. 제목은 `w-0 grow` 라 바탕 크기에 안 들어가 먼저 말줄임된다.
 * 한 줄일 때는 `min-h` 가 바 높이를 정하고 줄이 그만큼 늘어난다.
 */
export function MiniBar({
  status,
  tab,
  title,
  size = "sm",
  className,
}: {
  status: Status;
  tab: NoteTab;
  title?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const row = size === "md" ? "min-h-10" : "min-h-9";
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 border-b",
        APP.line,
        size === "md" ? "min-h-12 px-5" : "min-h-10 px-4",
        className
      )}
    >
      <span className={cn("flex min-w-0 flex-auto items-center gap-2", row)}>
        <StatusChip status={status} />
        {title ? (
          <span className={cn("w-0 grow truncate text-[13px] font-semibold", APP.ink)}>
            {title}
          </span>
        ) : null}
      </span>
      <TabStrip active={tab} size={size} className={cn("-mb-px self-stretch", row)} />
    </div>
  );
}

/* ── 문서 머리 ────────────────────────────────────────────────────────── */

const HEAD_ICON = {
  date: CalendarDays,
  calendar: Calendar,
  length: Clock,
  people: Users,
  project: Folder,
} as const;

const HEAD_CHIP = cn(
  "inline-flex h-[26px] min-w-0 items-center gap-1.5 rounded-[8px] border text-[12.5px]",
  APP.line,
  APP.body
);

/**
 * 머리 칩(`review-head.tsx` `Chip` · `note-timeline.tsx` `HeaderChip`). 검토 문서는 date(9월 1일 (화)
 * 오후 2:00) · length(2분) · project, 타임라인은 calendar(2026년 …) · people(4명) · project 를 쓴다.
 */
export function HeadChip({
  icon,
  children,
}: {
  icon: keyof typeof HEAD_ICON;
  children: ReactNode;
}) {
  const Icon = HEAD_ICON[icon];
  return (
    <span className={cn(HEAD_CHIP, "px-[9px]")}>
      <Icon aria-hidden className={cn("size-[13px] shrink-0", APP.muted)} />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** 참석자 칩(`review-head.tsx`). 얼굴 넷까지 + 「첫 이름 외 N명」. 이름 붙은 회의에만 선다. */
export function FacesChip({ names }: { names: string[] }) {
  return (
    <span className={cn(HEAD_CHIP, "pr-[9px] pl-1")}>
      <FacePile names={names.slice(0, 4)} size={18} />
      <span className="truncate">
        {names.length > 1 ? `${names[0]} 외 ${names.length - 1}명` : names[0]}
      </span>
    </span>
  );
}

/**
 * 문서 머리(`review-head.tsx`). 배지(검토 중 / 확정됨) + 오른쪽 aside → 세리프 제목 → 칩 줄.
 * `state` 를 비우면 배지 줄이 빠져 타임라인 탭의 머리(`note-timeline.tsx` header)가 된다.
 * 제목은 앱처럼 세리프 medium — 페이지의 굵은 고딕 제목과 갈려 「여기부터 앱」이 보인다.
 * 제목은 `<p>` 다(그림 안의 제목이 페이지 목차에 끼지 않게).
 */
export function ReviewHead({
  state,
  title,
  chips,
  aside,
  titleSize = "md",
  className,
}: {
  state?: "검토 중" | "확정됨";
  title: ReactNode;
  chips?: ReactNode;
  aside?: ReactNode;
  titleSize?: "md" | "lg";
  className?: string;
}) {
  return (
    <header className={cn("pb-1", className)}>
      {state ? (
        <div className="flex min-h-8 items-center gap-3">
          <span
            className={cn(
              "inline-flex h-5 items-center rounded-[6px] px-[7px] text-[11px] font-semibold transition-colors duration-200 ease-out",
              state === "확정됨" ? APP.success : cn(APP.chipBg, APP.body)
            )}
          >
            {state}
          </span>
          {aside ? <span className="ml-auto">{aside}</span> : null}
        </div>
      ) : null}
      <p
        className={cn(
          "m-0 font-serif font-medium tracking-[-0.4px] break-keep",
          APP.ink,
          state && "mt-2.5",
          titleSize === "lg" ? "text-[28px] leading-[38px]" : "text-[24px] leading-[32px]"
        )}
      >
        {title}
      </p>
      {chips ? <div className="mt-3 flex flex-wrap items-center gap-1.5">{chips}</div> : null}
    </header>
  );
}

/** 검토 문서 한 덩어리의 머리(`section-block.tsx`). 「결정 2」 · 「할 일 2」처럼 개수가 회색으로 붙는다. */
export function SectionHead({
  title,
  count,
  aside,
  className,
}: {
  title: string;
  count?: number;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-7 items-center justify-between gap-3", className)}>
      <p className={cn("m-0 flex items-baseline gap-[7px] text-[16px] font-semibold", APP.ink)}>
        {title}
        {count === undefined ? null : (
          <span className={cn("text-[13px] font-normal tabular-nums", APP.muted)}>{count}</span>
        )}
      </p>
      <span className="flex items-center gap-2">
        {aside}
        <Copy aria-hidden className={cn("size-3.5", APP.faint)} />
      </span>
    </div>
  );
}

/* ── 검토 줄(요약 탭) ─────────────────────────────────────────────────── */

const ROW_CONTENT = "block min-w-0 break-keep text-[15px] leading-6";

/**
 * 줄 사이 선(검토 줄 · 스크립트 줄). 앱은 마지막 줄에도 선을 긋지만, 잘라 보인 창 · 카드에서는 그 선이 프레임
 * 바닥 13~20px 위에 남아 바닥이 두 겹으로 읽혔다(근거 구간 두 창, 회의 카드). **뒤에 줄이 없으면 선을 지운다** —
 * 규칙은 `motion.tsx` 의 `.tv-row`(전역 `<style>` 한 줄)에 있다. `last:` 가 아닌 까닭: 구간들이 줄을 한 겹씩
 * 감싼다(히어로 `data-row`, 근거 구간의 번호표 칸 · 스크립트 `li`, 회의 카드의 형광펜 칸). `last:` 면 한 줄씩
 * 감싼 히어로의 선이 전부 지워지고, 번호표가 뒤따르는 근거 구간의 마지막 선은 남는다. 그래서 「줄 자신의
 * 뒤 형제, 또는 감싼 칸의 뒤 형제 안에 줄이 있나」를 본다(한 겹까지).
 */
const ROW_LINE = "tv-row border-b";

function RowChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("flex justify-end", APP.faint, className)}>
      <ChevronDown className={cn("size-4", open && "rotate-180 text-[var(--el-ink)]")} />
    </span>
  );
}

/**
 * 검토 문서의 결정 한 줄(`review-row.tsx` 결정). `체크 · 내용 · 주제 · 나온 때 · ⌄`.
 * 유형 이름은 없다 — 섹션 머리 「결정 N」이 유형을 말한다. `suggestions` 는 펼치지 않아도 줄 아래
 * 서는 제안(「이전 결정 대체」 `ReplacementRow`), `children` 은 펼쳤을 때(`open`)의 근거 · 수정/제외.
 */
export function DecisionRow({
  text,
  topic,
  at,
  open = false,
  excluded = false,
  suggestions,
  children,
  className,
}: {
  text: ReactNode;
  topic?: string;
  at?: string;
  open?: boolean;
  excluded?: boolean;
  suggestions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(ROW_LINE, APP.lineSoft, className)}>
      <div
        className={cn(
          "-mx-2 grid grid-cols-[16px_minmax(0,1fr)_auto_16px] items-center gap-x-3 rounded-[8px] px-2 py-[11px] transition-colors duration-200 ease-out",
          open && APP.chipBg
        )}
      >
        <span aria-hidden className="flex">
          <TimelineToneIcon tone="decision" />
        </span>
        <span
          className={cn(
            ROW_CONTENT,
            APP.ink,
            open && "font-semibold",
            excluded && "text-[var(--el-muted)] line-through"
          )}
        >
          {text}
        </span>
        <span className="flex min-w-0 items-center justify-end gap-3">
          {topic ? (
            <span
              className={cn(
                "hidden max-w-[180px] truncate text-[12.5px] sm:block",
                // 펼친 줄은 #f0efed 면이라 muted 도 4.2:1 — 한 단 더 진하게.
                open ? APP.body : APP.muted
              )}
            >
              {topic}
            </span>
          ) : null}
          {at ? (
            <span
              className={cn(
                "inline-flex h-[22px] items-center rounded-[6px] px-[7px] text-[12px] tabular-nums",
                APP.softBg,
                APP.body
              )}
            >
              {at}
            </span>
          ) : null}
        </span>
        <RowChevron open={open} />
      </div>
      {suggestions ? <div className="space-y-1.5 pb-2.5 sm:pl-7">{suggestions}</div> : null}
      {open && children ? <div className="space-y-2.5 pt-1 pb-3.5 sm:pl-7">{children}</div> : null}
    </div>
  );
}

/** 담당 칸의 그림(`assignee-cell.tsx` `AssigneeFace`). 이름 없는 화자는 회색 이름 + 작은 점이다. */
function Assignee({ who }: { who: { name: string } | { label: string } }) {
  const unnamed = "label" in who;
  return (
    <span className="inline-flex h-7 min-w-0 items-center">
      <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-[13px]", APP.ink)}>
        {unnamed ? <SpeakerFace label={who.label} size={18} /> : <Face who={who.name} size={18} />}
        <span className={cn("truncate", unnamed && APP.muted)}>
          {unnamed ? `화자 ${who.label}` : who.name}
        </span>
        {unnamed ? (
          <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-[var(--el-muted-soft)]" />
        ) : null}
      </span>
    </span>
  );
}

/** 기한 칩(`due-cell.tsx` chip). 없고 고칠 수 있으면 주황 점선 「기한 정하기」, 확정 뒤에는 아무것도 없다. */
function Due({ due, editable }: { due: string | null; editable: boolean }) {
  if (!due && !editable) return null;
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 rounded-[7px] px-[9px] text-[13px] whitespace-nowrap tabular-nums",
        due
          ? cn(APP.softBg, APP.body)
          : "border border-dashed border-[#efc2a8] text-[#b4501f]"
      )}
    >
      <CalendarDays aria-hidden className="size-[13px] shrink-0" />
      {due ?? "기한 정하기"}
    </span>
  );
}

/**
 * 검토 문서의 할 일 한 줄(`review-row.tsx` 할 일). `회색 둥근 네모 · 내용 · 담당 · 기한 · ⌄`.
 * 기본은 앱의 좁은 배치(담당 · 기한이 둘째 줄), `wide` 면 앱처럼 sm 부터 열로 선다.
 * `who` 는 `{ name }`(이름 붙은 사람) 또는 `{ label: "D" }`(이름 없는 화자 → 「화자 D」).
 * `editable` 을 끄면(확정됨) 기한 없는 줄에 「기한 정하기」가 안 선다.
 */
export function TaskRow({
  text,
  who,
  due,
  editable = true,
  excluded = false,
  wide = false,
  open = false,
  suggestions,
  children,
  className,
}: {
  text: ReactNode;
  who?: { name: string } | { label: string };
  due?: string | null;
  editable?: boolean;
  excluded?: boolean;
  wide?: boolean;
  open?: boolean;
  suggestions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const dueChip = due === undefined ? null : <Due due={due} editable={editable} />;
  const assignee = who ? (
    <Assignee who={who} />
  ) : editable ? (
    <span className={cn("inline-flex h-7 items-center text-[13px]", APP.muted)}>담당 정하기</span>
  ) : null;
  return (
    <div className={cn(ROW_LINE, APP.lineSoft, className)}>
      <div
        className={cn(
          "-mx-2 grid items-center gap-x-3 rounded-[8px] px-2 py-[11px] transition-colors duration-200 ease-out",
          wide
            ? "grid-cols-[16px_minmax(0,1fr)_16px] sm:grid-cols-[16px_minmax(0,1fr)_132px_150px_16px]"
            : "grid-cols-[16px_minmax(0,1fr)_16px]",
          open && APP.chipBg
        )}
      >
        <span
          aria-hidden
          className="size-4 rounded-[4px] border-[1.5px] border-[var(--el-hairline-strong)]"
        />
        <span
          className={cn(
            ROW_CONTENT,
            APP.ink,
            open && "font-semibold",
            excluded && "text-[var(--el-muted)] line-through"
          )}
        >
          {text}
        </span>
        {assignee || dueChip ? (
          <div
            className={cn(
              "col-[2/-1] row-start-2 flex min-w-0 flex-wrap items-center gap-x-3 pt-1.5",
              wide && "sm:contents"
            )}
          >
            {assignee ?? <span />}
            {dueChip ? <span className="flex">{dueChip}</span> : null}
          </div>
        ) : null}
        <RowChevron
          open={open}
          className={cn("col-start-3 row-start-1", wide && "sm:col-start-5")}
        />
      </div>
      {suggestions ? <div className="space-y-1.5 pb-2.5 sm:pl-7">{suggestions}</div> : null}
      {open && children ? <div className="space-y-2.5 pt-1 pb-3.5 sm:pl-7">{children}</div> : null}
    </div>
  );
}

/**
 * 근거 발언 목록(`evidence-quotes.tsx`). 앱에서도 상자다(hairline · rounded-10). 인용한 줄은 먹색,
 * 그 앞 맥락 줄은 회색. 화자는 `who`(이름) 또는 `label`(「화자 A」). `text` 에 형광펜 span 을 넣어도 된다.
 * **sm 미만은 상자 대신 왼쪽 세로선 하나다.** 좁은 화면에서는 펼친 칸의 들여쓰기(`sm:pl-7`)가 없어 상자가 창
 * 양옆 약 20px 안쪽에 나란히 서서 창과 동심 두 겹으로 읽혔다(390 근거 구간 · 히어로). 선을 한쪽에만 두면
 * 인용 묶음이라는 뜻은 남고 테두리는 생기지 않는다. sm 부터는 들여 선 앱 상자 그대로다.
 */
export function EvidenceQuotes({
  quotes,
  className,
}: {
  quotes: Array<{
    who?: string;
    label?: string;
    at: string;
    text: ReactNode;
    cited: boolean;
  }>;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "m-0 flex list-none flex-col gap-1 rounded-[10px] border px-2 py-1.5",
        "max-sm:rounded-none max-sm:border-0 max-sm:border-l-2 max-sm:py-0 max-sm:pr-0 max-sm:pl-1.5",
        APP.line,
        className
      )}
    >
      {quotes.map((quote) => (
        <li
          key={`${quote.at}-${quote.who ?? quote.label}`}
          className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-2.5 rounded-[8px] px-1.5 py-1.5"
        >
          <span className="pt-0.5">
            {quote.who ? (
              <Face who={quote.who} />
            ) : quote.label ? (
              <SpeakerFace label={quote.label} />
            ) : null}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={cn("text-[12.5px] leading-5", APP.muted)}>
              <span className={cn("font-medium", APP.body)}>
                {quote.who ?? (quote.label ? `화자 ${quote.label}` : "화자 없음")}
              </span>
              {" · "}
              <span className="tabular-nums">{quote.at}</span>
            </span>
            <span
              className={cn(
                "text-[14px] leading-[22px] break-keep",
                quote.cited ? APP.ink : APP.muted
              )}
            >
              {quote.text}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 펼친 줄의 「수정」 「제외」(`review-row.tsx`, outline xs 버튼). 뺀 줄은 「제외 취소」 하나다. */
export function RowActions({ excluded = false }: { excluded?: boolean }) {
  const button = cn(
    "inline-flex h-6 items-center rounded-[8px] border bg-[var(--el-canvas)] px-2 text-[12px] font-medium",
    APP.line,
    APP.ink
  );
  return (
    <span className="flex flex-wrap gap-1.5">
      {excluded ? null : <span className={button}>수정</span>}
      <span className={button}>{excluded ? "제외 취소" : "제외"}</span>
    </span>
  );
}

/* ── 확정 막대 ────────────────────────────────────────────────────────── */

/** 숫자가 바뀌면 그 숫자만 한 번 스며든다(`confirm-bar.tsx` `Count`). */
function Count({ value }: { value: number }) {
  return (
    <b
      key={value}
      className={cn(
        "inline-block font-semibold tabular-nums animate-in fade-in-0 zoom-in-95 duration-200 ease-out motion-reduce:animate-none",
        APP.ink
      )}
    >
      {value}
    </b>
  );
}

type ConfirmState =
  | { kind: "ready"; decisions: number; tasks: number; ended?: number }
  | { kind: "unchosen"; n: number };

/**
 * 막대 모양. 앱에는 `float` 하나뿐이고(`confirm-bar.tsx`: 둥근 14 · 선 · 그림자), 나머지는 창 · 카드 폭에 맞춘
 * 잘라 보이기다 — 문구 · 버튼 · 상태는 모두 같다.
 * - `float`: 앱 그대로. **넓은 창 가운데, 또는 창 바닥 가장자리에 반쯤 걸칠 때만 쓴다.** 창 · 카드 폭을 거의
 *   다 채우고 바닥 20px 위에 서면 프레임과 나란한 둥근 선이 한 겹 더 생긴다(주간 카드 · 근거 창 · 390 히어로).
 * - `pill`: 좁은 알약. 폭을 264 이하로 묶어 가운데 서고, 글자 12.5 · 버튼도 알약이다. 카드 폭 330 이면 양옆이
 *   프레임에서 약 33px, 390 창이면 약 47px 떨어져 동심으로 읽히지 않는다. 문구는 두 줄(덩어리마다), 「이전 결정
 *   N개 끝남」이 붙으면 세 줄이다. 300 미만 폭(320 화면의 카드)에서는 양옆이 다시 좁아지니 `plate` 를 쓴다.
 * - `plate`: 선 · 그림자 없는 회색 판(`--el-canvas` #f5f5f5 — 주황 「확인할 제안」 4.7:1). 폭을 다 써도 선이
 *   없어 테두리로 읽히지 않는다.
 * - `dock`: 창 바닥에 붙인 띠(위 hairline 하나). 프레임 바닥이 곧 띠의 바닥이라 겹이 없다.
 */
const BAR = {
  float: cn(
    "relative flex min-h-[50px] max-w-full flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[14px] border bg-white/[0.98] py-[7px] pr-[7px] pl-[18px]",
    APP.line,
    SHADOW.app
  ),
  pill: cn(
    "relative mx-auto flex w-fit max-w-[min(100%,264px)] items-center gap-x-2.5 rounded-[22px] border bg-white/[0.98] py-1.5 pr-[7px] pl-4",
    APP.line,
    SHADOW.app
  ),
  plate:
    "relative flex min-h-[50px] max-w-full flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[12px] bg-[var(--el-canvas)] py-[7px] pr-[7px] pl-4",
  dock: cn("flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-white px-4 py-3", APP.lineSoft),
} as const;

/**
 * 검토 완료 막대(`confirm-bar.tsx`). 모양은 위 `BAR` — 창 폭을 거의 다 채우는 자리면 `float` 대신 `pill` ·
 * `plate` · `dock` 중 하나를 고른다(동심 테두리 금지). 고를 제안이 남았으면 주황 「확인할 제안 N개」와 흐린 버튼.
 * 문구는 덩어리(「결정 N개와 할 일 N개를」 · 「프로젝트에 올립니다」 · 「· 이전 결정 N개 끝남」)마다 줄바꿈을
 * 막는다 — 좁은 폭에서 「이전 / 결정」처럼 끊기지 않게(주간 카드가 요청한 칸). 읽히는 글은 앱과 같다.
 * `buttonSlot` 은 「검토 완료」 버튼 안에 그린다 — 커서 · 링 자리(`relative`). 링 모서리를 `rounded-[inherit]`
 * 로 두면 모양마다 버튼 모서리(9px / 알약)를 따른다.
 */
export function ConfirmBar({
  variant = "float",
  state,
  buttonSlot,
  className,
}: {
  variant?: keyof typeof BAR;
  state: ConfirmState;
  buttonSlot?: ReactNode;
  className?: string;
}) {
  const pill = variant === "pill";
  return (
    <div className={cn(BAR[variant], className)}>
      {state.kind === "unchosen" ? (
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              "inline-flex items-center gap-2 font-medium text-[#b4501f]",
              pill ? "text-[12.5px]" : "text-[13.5px]"
            )}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-[#eb6834]" />
            <span className="whitespace-nowrap">
              확인할 제안 <Count value={state.n} />개
            </span>
          </span>
          <span
            className={cn(
              "whitespace-nowrap underline decoration-[var(--el-hairline-strong)] underline-offset-[3px]",
              pill ? "text-[12px]" : "text-[13px]",
              APP.body
            )}
          >
            제안으로 가기
          </span>
        </span>
      ) : (
        <span
          className={cn(
            "min-w-0 break-keep",
            pill ? "text-[12.5px] leading-[1.4]" : "text-[13.5px]",
            APP.body
          )}
        >
          <span className="whitespace-nowrap">
            결정 <Count value={state.decisions} />개와 할 일 <Count value={state.tasks} />개를
          </span>{" "}
          <span className="whitespace-nowrap">프로젝트에 올립니다</span>
          {state.ended ? (
            <>
              {" "}
              <span className="whitespace-nowrap">
                · 이전 결정 <Count value={state.ended} />개 끝남
              </span>
            </>
          ) : null}
        </span>
      )}
      {pill ? null : (
        <span aria-hidden className="hidden h-5 w-px bg-[var(--el-hairline)] sm:block" />
      )}
      <span
        className={cn(
          "relative ml-auto inline-flex shrink-0 items-center font-medium",
          pill ? "h-8 rounded-full px-3.5 text-[12.5px]" : "h-9 rounded-[9px] px-4 text-[13px]",
          APP.primary,
          state.kind === "unchosen" && "opacity-50"
        )}
      >
        검토 완료
        {buttonSlot}
      </span>
    </div>
  );
}

/* ── 제안(이전 결정 대체) ─────────────────────────────────────────────── */

/** 「끝내기 / 유지」 두 칸의 클래스(`choice-toggle.tsx`). 진짜 `role="radio"` 버튼은 구간이 이걸로 만든다. */
export const CHOICE = {
  group: "inline-flex shrink-0 rounded-full bg-[var(--el-surface-strong)] p-0.5",
  option:
    "inline-flex h-[22px] items-center gap-1 rounded-full border border-transparent px-2.5 text-[11.5px] font-medium whitespace-nowrap text-[var(--el-muted)]",
  changeOn:
    "border-[var(--el-success)]/30 bg-[var(--el-success)]/10 text-[var(--el-success-strong)]",
  keepOn: "bg-[var(--el-primary)] text-white",
} as const;

/** 고른 쪽 「끝내기」 앞의 체크(`choice-toggle.tsx`). 진짜 버튼에도 같이 쓴다. */
export function ChoiceCheck() {
  return <Check aria-hidden className="size-[11px]" strokeWidth={3} />;
}

/**
 * 「이전 결정 대체」 제안 한 줄(`suggestion-row.tsx` `SuggestionShell` + `ReplacementSuggestion`).
 * 앱에서도 옅은 면(canvas-soft)이다. 카드가 좁아 늘 앱의 좁은 배치(세로)로 선다.
 * `meta` 는 「2차 스프린트 킥오프 · 8월 25일 확정」 같은 출처, `toggle` 은 `CHOICE` 로 만든 진짜 버튼.
 */
export function ReplacementRow({
  target,
  meta,
  reason,
  toggle,
  className,
}: {
  target: ReactNode;
  meta: ReactNode;
  reason?: ReactNode;
  toggle: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[8px] px-3 py-2.5 text-[12.5px]", APP.softBg, APP.body, className)}>
      <div className="grid grid-cols-1 items-center justify-items-start gap-x-3 gap-y-1.5">
        <span className={cn("text-[12px] whitespace-nowrap", APP.muted)}>이전 결정 대체</span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("break-keep", APP.ink)}>{target}</span>
          <span className={cn("text-[12px]", APP.muted)}>{meta}</span>
        </span>
        {toggle}
      </div>
      {reason ? <p className={cn("m-0 mt-1.5 text-[12px] break-keep", APP.muted)}>{reason}</p> : null}
    </div>
  );
}

/* ── 타임라인(회의 중) ────────────────────────────────────────────────── */

/** 「논의 중」 칩(`note-timeline.tsx`). 기록 중인 회의의 마지막 안건에만 선다. 점 깜빡임은 `blink`. */
export function LiveChip({ blink = false }: { blink?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-[5px] rounded-[6px] px-2 text-[12px]",
        APP.success
      )}
    >
      <span className={cn("size-1.5 rounded-full bg-[var(--el-success)]", blink && "tv-blink")} />
      논의 중
    </span>
  );
}

/**
 * 안건 머리(`note-timeline.tsx` 안건 h3). `시간 구간 · 제목 · 개수 · ›` 와 기록 중이면 오른쪽 「논의 중」.
 * 기본은 그림(`div`). 히어로처럼 진짜로 접는 자리는 `as="button"` + `aria-expanded` · `onClick` 을
 * 넘긴다(포커스 링은 넘기는 쪽이 `className` 으로).
 */
export function AgendaHead({
  range,
  title,
  total,
  open = true,
  live = false,
  blink = false,
  as: Tag = "div",
  className,
  ...rest
}: {
  range?: string;
  title: string;
  total: number;
  open?: boolean;
  live?: boolean;
  blink?: boolean;
  as?: "div" | "button" | "h3" | "h4";
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "title">) {
  const buttonProps: Record<string, string> = Tag === "button" ? { type: "button" } : {};
  return (
    <Tag
      {...buttonProps}
      className={cn(
        "-mx-2 flex h-[30px] w-[calc(100%+16px)] items-center gap-0.5 text-left",
        className
      )}
      {...rest}
    >
      {range ? (
        <span className={cn("shrink-0 px-2 text-[12px] tabular-nums", APP.muted)}>{range}</span>
      ) : null}
      <span
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-2.5 pr-2",
          range ? "pl-1" : "pl-2"
        )}
      >
        <span className={cn("min-w-0 truncate text-[15px] font-semibold", APP.ink)}>{title}</span>
        <span className={cn("-ml-1 shrink-0 text-[12.5px] tabular-nums", APP.muted)}>{total}</span>
        <ChevronRight
          aria-hidden
          className={cn("-ml-1.5 size-3.5 shrink-0", APP.faint, open && "rotate-90")}
        />
        <span className="flex-1" />
        {live ? <LiveChip blink={blink} /> : null}
      </span>
    </Tag>
  );
}

/** 타임라인 목록(`note-timeline.tsx` ol). 아이콘 열을 잇는 세로선 하나가 깔린다. */
export function TimelineList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ol className={cn("relative m-0 list-none p-0", className)}>
      <span
        aria-hidden
        className="absolute top-4 bottom-4 left-[63px] w-px bg-[var(--el-hairline)]"
      />
      {children}
    </ol>
  );
}

/**
 * 타임라인 한 줄(`note-timeline.tsx` `TimelineRow`). `시각 · 아이콘 · 제목 / 유형 이름 · 메타 · ⌄`.
 * **담당 · 기한 · 화자 이름은 없다**(그건 요약 탭의 검토 줄). `retracted` 면 아이콘이 회색 점, 제목이
 * 그어지고 메타 앞에 붉은 「철회됨」. `meta` 는 앱이 덧붙이는 말만 — 「답을 기다리는 중」 · 「00:44에
 * 답함」 · 「내용 보강」. `flash` 는 방금 붙은 줄의 노란 섬광(창 위 주석), `dim` 은 스포트라이트 밖의 줄.
 * `open` + `cites` 면 앱처럼 근거 발언 상자가 아래 펼쳐진다.
 */
export function TimelineRow({
  at,
  tone,
  kind,
  title,
  meta,
  metaTone,
  retracted = false,
  flash = false,
  dim = false,
  open = false,
  cites,
  className,
}: {
  at: string;
  tone: TimelineTone;
  kind: string;
  title: ReactNode;
  meta?: string;
  metaTone?: "error";
  retracted?: boolean;
  flash?: boolean;
  dim?: boolean;
  open?: boolean;
  cites?: Array<{ at: string; text: ReactNode }>;
  className?: string;
}) {
  const parts = [
    ...(retracted ? [{ text: "철회됨", error: true }] : []),
    ...(meta ? [{ text: meta, error: metaTone === "error" }] : []),
  ];
  return (
    <li
      className={cn(
        "tv-dim relative grid grid-cols-[44px_40px_minmax(0,1fr)] py-[7px]",
        flash && "tv-flash rounded-[8px]",
        dim ? "opacity-40" : "opacity-100",
        className
      )}
    >
      <span className={cn("self-start text-right text-[12px] leading-6 tabular-nums", APP.muted)}>
        {at}
      </span>
      <span className="flex justify-center pt-1">
        <span className="inline-flex rounded-full bg-white">
          <TimelineToneIcon tone={tone} retracted={retracted} />
        </span>
      </span>
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
          <span className="flex min-w-0 flex-col">
            <span
              className={cn(
                "break-keep text-[15px] leading-6",
                retracted
                  ? "text-[var(--el-muted)] line-through"
                  : TONE_TITLE[tone]
              )}
            >
              {title}
            </span>
            <span className={cn("text-[12.5px] leading-[19px]", APP.muted)}>
              <span className={ROLE_TEXT[tone]}>{kind}</span>
              {parts.map((part) => (
                <span key={part.text}>
                  <Dots />
                  <span className={part.error ? cn("font-medium", APP.recStrong) : undefined}>
                    {part.text}
                  </span>
                </span>
              ))}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "mt-1 size-4 text-[var(--el-hairline-strong)]",
              open && "rotate-180"
            )}
          />
        </div>
        {open && cites?.length ? (
          <div className={cn("mt-2.5 overflow-hidden rounded-[10px] border", APP.line)}>
            <ul className="m-0 flex list-none flex-col gap-0.5 px-2 py-2">
              {cites.map((cite) => (
                <li
                  key={cite.at}
                  className="grid grid-cols-[40px_minmax(0,1fr)] gap-x-2.5 rounded-[7px] px-1.5 py-1"
                >
                  <span className={cn("text-[12px] leading-[22px] tabular-nums", APP.muted)}>
                    {cite.at}
                  </span>
                  <span className={cn("break-keep text-[14px] leading-[22px]", APP.bodyStrong)}>
                    {cite.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/* ── 스크립트 ─────────────────────────────────────────────────────────── */

/**
 * 스크립트 한 줄(`note-archive.tsx` 발화 · `transcript-view.tsx`). `mono 시각 | (회의 뒤에만) 화자 칩 /
 * 말`. **화자 칩은 회의가 끝나 화자가 갈린 뒤에만 붙는다** — 기록 중에는 넘기지 않는다. 이름을
 * 안 붙였으면 `{ label: "A" }`(「화자 A」 + 아직 확인 안 한 화자 점). `live` 는 받아 적는 중인 줄:
 * 옅은 면이 깔리고 시각 자리에 붉은 점 + 「받아 적는 중」, 끝에 캐럿이 선다.
 */
export function ScriptRow({
  at,
  speaker,
  live = false,
  children,
  className,
}: {
  at: string;
  speaker?: { name: string } | { label: string };
  live?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const unnamed = speaker !== undefined && "label" in speaker;
  return (
    <div
      className={cn(
        "grid grid-cols-[58px_minmax(0,1fr)] gap-4 py-4 sm:grid-cols-[66px_minmax(0,1fr)] sm:gap-6",
        // 받아 적는 줄도 `tv-row` 다 — 그 위 줄은 뒤에 줄이 있으니 앱처럼 선을 지킨다.
        live ? cn("tv-row -mx-4 rounded-[6px] px-4", APP.softBg) : cn(ROW_LINE, APP.line),
        className
      )}
    >
      {live ? (
        <span
          className={cn(
            "flex items-center gap-1.5 self-start pt-1 text-[11px] whitespace-nowrap",
            APP.muted
          )}
        >
          <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />
          받아 적는 중
        </span>
      ) : (
        <span className={cn("pt-1 font-mono text-[11px] tabular-nums", APP.muted)}>{at}</span>
      )}
      <div className="min-w-0">
        {speaker ? (
          <span
            className={cn("mb-1 inline-flex items-center gap-1.5 text-[13px] font-medium", APP.muted)}
          >
            {unnamed ? <SpeakerFace label={speaker.label} /> : <Face who={speaker.name} />}
            {unnamed ? `화자 ${speaker.label}` : speaker.name}
            {unnamed ? (
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--el-muted-soft)]" />
            ) : null}
          </span>
        ) : null}
        <p
          className={cn(
            "m-0 break-keep text-[15px] leading-7 tracking-[0.005em]",
            live ? APP.body : APP.ink
          )}
        >
          {children}
          {live ? (
            <span
              aria-hidden
              className="ml-1 inline-block h-4 w-px animate-pulse bg-[var(--el-muted)] align-middle"
            />
          ) : null}
        </p>
      </div>
    </div>
  );
}

/* ── 내 에이전트 ──────────────────────────────────────────────────────── */

/** 오른쪽 레일의 머리(`note-agent-rail.tsx`). 「내 에이전트 · 나만 보는 대화 · 현재 회의 범위」 + 접기. */
export function RailHead({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-12 shrink-0 items-center gap-2 border-b pr-2 pl-4", APP.line, className)}>
      <Sparkles aria-hidden className={cn("size-[15px] shrink-0", APP.ink)} />
      <span className={cn("shrink-0 text-[13px] font-semibold", APP.ink)}>내 에이전트</span>
      <span className={cn("min-w-0 truncate text-[12px]", APP.muted)}>
        나만 보는 대화 · 현재 회의 범위
      </span>
      <span className="flex-1" />
      <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center", APP.muted)}>
        <PanelRightClose className="size-4" />
      </span>
    </div>
  );
}

/** 대화 제목 줄(`personal-chat.tsx` header). 제목 + 새 대화(＋) · 기록. */
export function ThreadTitle({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1 border-b py-3 pr-3 pl-5", APP.line, className)}>
      <span className={cn("min-w-0 flex-1 truncate text-[14px] font-medium", APP.ink)}>{title}</span>
      <span aria-hidden className={cn("flex items-center", APP.ink)}>
        <span className="flex size-8 items-center justify-center">
          <Plus className="size-4" />
        </span>
        <span className="flex size-8 items-center justify-center">
          <History className="size-4" />
        </span>
      </span>
    </div>
  );
}

/**
 * 범위 칩(`lib/chat/scope-chip.ts` 의 클래스를 그대로 쓴다). 회의록은 초록 + 문서 아이콘, 프로젝트는
 * 파랑 + 폴더 아이콘. 입력창과 말풍선이 같은 칩이다.
 */
export function ScopeChip({
  kind = "note",
  title,
  className,
}: {
  kind?: "note" | "project";
  title: string;
  className?: string;
}) {
  const Icon = kind === "project" ? Folder : FileText;
  return (
    <span className={scopeChipClass(kind, { extra: className })}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{title}</span>
    </span>
  );
}

/** 내가 보낸 말(`chat-thread.tsx` `UserBubble`). 오른쪽 · 회색 면 · 모서리 16 균일 — **꼬리 없음.** 칩은 문장 앞. */
export function UserBubble({
  chip,
  children,
  className,
}: {
  chip?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-end", className)}>
      <p
        className={cn(
          "m-0 max-w-[85%] rounded-[16px] px-3.5 py-2.5 text-[14px] leading-relaxed break-keep whitespace-pre-wrap",
          APP.chipBg,
          APP.ink
        )}
      >
        {chip}
        {children}
      </p>
    </div>
  );
}

/** 에이전트의 답(`markdown.tsx` 본문). 말풍선 없이 본문 글자로 선다. */
export function Answer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("m-0 text-[14px] leading-[1.65] break-keep", APP.body, className)}>{children}</p>
  );
}

/** 참고한 회의록 칩 줄. 정적 그림과 눌리는 판이 같이 쓴다. */
export function RefChips({ refs }: { refs: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5 pt-1.5">
      {refs.map((ref) => (
        <span
          key={ref}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--el-hairline-strong)] px-2 py-0.5 text-[11px]",
            APP.body
          )}
        >
          <FileText aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{ref}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * 입력창(`chat-composer.tsx`). `chip` 은 붙인 범위(`ScopeChip`), `children` 은 그 뒤에 쓴 글.
 * 둘 다 없으면 앱의 안내 문구가 선다. `busy` 면 보내기(↑) 대신 중지(■) — 답이 흐르는 동안이다.
 */
export function Composer({
  chip,
  busy = false,
  children,
  className,
}: {
  chip?: ReactNode;
  busy?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const empty = !chip && !children;
  return (
    <div
      className={cn(
        "flex shrink-0 items-end gap-2.5 rounded-[10px] border border-[var(--el-hairline-strong)] bg-white px-3.5 py-3",
        className
      )}
    >
      <span
        className={cn(
          "min-h-9 min-w-0 flex-1 py-[5px] text-[15px] leading-[1.75] break-keep",
          empty ? APP.muted : APP.ink
        )}
      >
        {empty ? (
          "@로 프로젝트·회의록을 참조해 물어보세요"
        ) : (
          <>
            {chip}
            {children}
          </>
        )}
      </span>
      {busy ? (
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border bg-[var(--el-canvas)]",
            APP.line,
            APP.ink
          )}
        >
          <Square className="size-3.5" />
        </span>
      ) : (
        <span
          aria-hidden
          className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", APP.primary)}
        >
          <ArrowUp className="size-4" />
        </span>
      )}
    </div>
  );
}

/**
 * 앱 메타 줄의 구분점 「·」. 점은 장식이라 숨기고, 화면 읽기 프로그램에는 쉼표를 남긴다 — 점만 숨기면
 * 앞뒤 글자 사이에 공백이 없어 「결정철회됨」 · 「질문00:44에 답함」처럼 한 낱말로 붙어 읽혔다.
 */
function Dots() {
  return (
    <>
      <span aria-hidden className="mx-1.5 text-[var(--el-hairline-strong)]">
        ·
      </span>
      <span className="sr-only">, </span>
    </>
  );
}
