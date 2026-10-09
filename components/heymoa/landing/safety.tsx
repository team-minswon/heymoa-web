import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  PencilLine,
  Plug,
  Sparkles,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Reveal } from "@/components/heymoa/landing/reveal";
import { cn } from "@/lib/utils";

import { Answer, AppWindow, Composer, RailHead, ScopeChip, UserBubble } from "./app";
import { Cursor, ExampleStamp, Hand, Scribble, Sticky } from "./marks";
import {
  APP,
  BODY,
  CARD_TITLE,
  CONTAINER,
  H2,
  LEAD,
  MARKER_REVEAL,
  RADIUS,
  SECTION_Y,
  SHADOW,
  vars,
} from "./tokens";

/**
 * 「도구 연결」 구간. tl;dv 는 여기에 SOC2 · GDPR 배지를 격자로 놓는다. HeyMoa 에는 인증이 없으므로
 * 배지 자리에 **지금 앱에서 그렇게 동작하는 화면**을 놓았다. 에이전트가 회의를 쓰던 도구로 잇는 두 자리를
 * 그림 두 장으로:
 * 버터 면 「내 에이전트」(HeyMoa 안)는 만화 두 컷(① 승인 카드가 뜬 대화 → ② 승인한 뒤 생각 과정에 남은
 * 「열어 보기」)과 그 컷에 짝지은 왼쪽 열의 번호 단계 둘(넓은 화면에서는 단계가 제 컷 높이에 선다 — 2행
 * 격자, 두 컷은 겹치지 않고 칸 사이를 띄운다),
 * 민트 면 「외부 에이전트 연결」(Claude Code · Codex)은 가장자리가 뜯기는 출입증(앞면 = 설정의 외부 에이전트
 * 연결 한 줄, 꼬리 = 도장 셋).
 * 두 타일은 **어디서 부르는 에이전트인가**로 가른다. 전에는 「쓰는 길 · 읽는 길」로 갈랐는데, 내 에이전트도
 * 회의를 묻고 답하고 외부 에이전트도 가져간 회의로 제 일을 하니 사용자에게 틀린 구분으로 읽혔다(APP-934).
 * 예전의 다섯 칸 같은 틀(템플릿 느낌)과 복숭아 · 하늘 면은 뺐다.
 *
 * 화면 규칙 5(창 하나에 테두리 하나): 창 안에서 앱의 테두리 상자는 상자를 걷고 hairline 구분선으로 줄인다.
 * - 외부 에이전트 창의 연결 한 줄 — 위 hairline 하나.
 * - 승인 창의 승인 카드 — 위 hairline 하나. 카드 테두리(창 가장자리와 16~20px 평행)와 바로 아래 같은 폭의
 *   입력창 테두리가 창 안에 둥근 상자 둘로 쌓여 보였다.
 * - 같은 창의 입력창 — 상자를 걷고 위 hairline + 칩 · ■ 한 줄로 바닥에 붙인다. 칩 · ■ · 「승인을 기다리는
 *   동안에는…」은 앱 그대로다.
 * - 회색 인자 블록 — 채움만(선 없음).
 * 좁은 화면(sm 미만)에서는 버터 · 민트 면을 화면 끝까지 깐다 — 면 가장자리가 창 양옆 20px 에 평행하게
 * 남으면 색 띠가 창의 두 번째 테두리로 읽혔다. sm 부터는 면 안쪽 여백을 32px 이상으로 둔다.
 *
 * 제목은 「쓰던 도구까지 이어진다」만 말하고 「~로만」 · 「길은 N개」처럼 닫지 않는다 — 요약 · 답을 만들 때
 * 스크립트 · 노트 · 질문이 언어 모델 제공자에게 가고(`app/(static)/privacy/page.tsx`), 요약 · 스크립트를
 * 마크다운으로 복사하는 버튼(`copy-markdown-button.tsx`)도 있어서 닫으면 틀린 말이 된다.
 * 「내가 연결한 도구」라고도 하지 않는다 — Linear·GitHub 연동은 워크스페이스 연동이라 관리자만 연결·해제한다
 * (`workspace-integrations-settings.tsx`). 일반 멤버가 여는 것은 만들 때마다의 승인과 내가 만든 외부 에이전트
 * 연결이다. 그 한 가지(내가 연다)는 각 타일이 말한다 — 내 에이전트는 제목(「승인한 것만 나갑니다」), 외부
 * 에이전트는 본문 끝(「연결은 직접 만들고, 언제든 끊을 수 있습니다」). 리드에서 「어느 쪽이든 내가 열어 줘야
 * 열립니다」로 한 번 더 묶었었는데 겹쳐서 뺐다.
 *
 * 창 안은 앱 그대로다. 근거 파일:
 * - `components/chat/chat-thread.tsx` ApprovalPrompt 802-888(카드 · 「쓰기 도구」 배지 · 승인/거절 ·
 *   안내 문구), ApprovalArgs 757-796(인자 키는 도구 이름 그대로, 모바일은 키가 값 위로). 카드 · 인자 ·
 *   입력창의 테두리는 위 화면 규칙 5대로 줄였다.
 * - `components/chat/personal-chat.tsx` 661-665 — 승인을 기다리는 동안 입력창 아래 「승인을 기다리는
 *   동안에는 입력할 수 없습니다.」, `chat-composer.tsx` 141-152 흐르는 동안 ■ 중지. 회의록 안에서 연
 *   레일은 그 회의록 칩이 입력창에 붙어 있고 보낸 뒤에도 남는다(`personal-chat.test.tsx` 1612).
 * - `components/chat/chain-of-thought.tsx` 217-241(끝난 묶음 이름 「생각 과정」), 274-346(「승인함 · …」 줄,
 *   도구 줄 + 「열어 보기」 링크). 끝난 묶음은 접혀 있고, 그림은 펼친 상태다.
 *   도구 줄이 「승인함」 줄 위인 근거는 heymoa-ai 다: `session.py` `_resume_pending`(「시작 사건은 승인
 *   카드를 낸 앞 조각이 냈고」)과 `tests/integration/test_tool_approval.py`(tool_call_start 가 정확히 하나)
 *   — tool_call_start 는 승인 카드를 낸 앞 조각에서 나가므로 도구 블록이 승인 요청보다 먼저 선다.
 *   web `lib/chat/blocks.ts` settleTool 과 `blocks.test.ts` 72 의 주석(「승인을 거친 쓰기 도구는
 *   tool_call_start 없이 곧장 결과가 온다」)은 낡은 설명이라 근거로 쓰지 않는다 — 그걸 보고 순서를 뒤집지 말 것.
 * - 문구는 heymoa-ai 에서 확인: 승인 카드 요약 = `summarize_create_issue`(「Linear 이슈 만들기 · {title}」),
 *   쓰기 도구 결과 = `_write_success`(「{식별자} 이슈를 만들었습니다: {url}」, 시작 요약 뒤에 「 · 」로 붙음).
 * - `components/settings/agent-connections-settings.tsx` 51-79(상태 · 도구 이름), 122-143(세리프 머리),
 *   535-647(DelegationRow — 회수는 destructive 변형이라 **옅은 붉은 바탕 + 진한 붉은 글자**다),
 *   653-769(사용 내역 — 시각 · 도구 · N건).
 * - heymoa-server `AgentDelegation.IDLE_EXPIRY` 90일 · `touch()` 가 쓸 때마다 만료를 민다(최근 사용 9월 3일
 *   → 12월 2일), `AgentTokenCodec` 앞자리 = `hm_` + 7자, MCP 도구마다 `resultCount`(연결 확인 · 화면 열기 = 1).
 */

/* ── 공통 ─────────────────────────────────────────────────────────────── */

/**
 * 창 안 작은 글자(12~14px)용 형광펜. 제목용 `MARKER`(0.42em 띠)는 작은 글자에서 글자 밑을 긋는 선처럼
 * 보여 취소선으로 읽혔다 — 글자 아래 절반을 반투명하게 덮어 밑줄 띠로 읽히게 한다. 칠 앞뒤 여백(-mx-1)이
 * 없어서 앞의 가운뎃점을 덮지 않는다. 스크롤 등장은 `MARKER_REVEAL` 과 같은 `tv-rmark`(지연 `--d`).
 */
const PEN =
  "tv-rmark bg-[linear-gradient(color-mix(in_srgb,var(--tv-pop)_55%,transparent),color-mix(in_srgb,var(--tv-pop)_55%,transparent))] bg-no-repeat [background-size:100%_0.62em] [background-position:0_92%] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";

/**
 * 앱 버튼(높이 30~32 · 폭 약 46) 위 커서 자리. 화살 끝이 버튼 **왼쪽 가장자리**, 높이 2/3(글자 아래 끝
 * 바로 밑)에 닿는다. 예전엔 끝이 글자 오른쪽 아래(62%, 56%)에 서서 「승인」의 「인」을 덮었다. 오른쪽 아래
 * 모서리로 옮기면 화살 아래 날개가 바로 밑(8px) 안내 글자 「…때까지」를 찌르고 옆 「거절」(8px)에도 닿는다
 * — 왼쪽은 「승인」이면 카드 여백, 「회수」면 「사용 내역」 아이콘까지 16px 비어 있어 누구도 덮지 않는다.
 * 몸통은 버튼 왼쪽 아래 안쪽 여백(글자 시작 10px 앞)과 그 밑 8px 틈에만 걸친다.
 */
const CURSOR_AT = "top-[55%] left-[-5px]";

/** 타일 머리 — 흰 알약 라벨 · 굵은 제목 · 본문. */
function TileHead({
  icon: Icon,
  label,
  title,
  bodyClassName,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  title: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-extrabold text-[var(--tv-ink)]">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </span>
      {/* text-balance — 1024 에서 둘째 타일 제목이 한 낱말만 다음 줄로 떨어졌다. */}
      <h3 className={`${CARD_TITLE} mt-4 text-balance lg:text-[28px]`}>{title}</h3>
      <p className={cn(BODY, "mt-2", bodyClassName)}>{children}</p>
    </div>
  );
}

/** 만화 컷 번호 — 창 왼쪽 위 모서리 바깥. 창 안 글자(레일 머리의 ✦)에 닿지 않게 16px 밖으로 뺐다. */
function PanelNo({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute -top-4 -left-2 z-10 grid size-8 sm:-left-4 place-items-center rounded-full bg-[var(--tv-ink)] text-[14px] font-extrabold text-white",
        SHADOW.sticky
      )}
    >
      {n}
    </span>
  );
}

/**
 * 왼쪽 열의 번호 단계 — 오른쪽 컷 번호(`PanelNo`)와 같은 먹색 원을 크게 그려 짝을 맞춘다. 번호는
 * 그림이고 손글씨 제목 · 본문은 읽힌다. `note` 는 그 컷을 가리키는 쪽지(`Pointer`).
 */
function Step({
  n,
  title,
  note,
  className,
  children,
}: {
  n: number;
  title: string;
  note: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full bg-[var(--tv-ink)] text-[20px] font-extrabold text-white lg:size-12 lg:text-[22px]",
            SHADOW.sticky
          )}
        >
          {n}
        </span>
        <div className="min-w-0 pt-1.5">
          <Hand aria-hidden={false} className="block text-[19px] leading-[1.3] lg:text-[21px]">
            {title}
          </Hand>
          <p className={cn(BODY, "mt-1.5")}>{children}</p>
        </div>
      </div>
      {note}
    </div>
  );
}

/**
 * 단계에 붙은 쪽지 + 컷 쪽으로 뻗는 화살표(넓은 화면에서만). 화살 끝은 창 본문 여백 안에서 멈춘다.
 * 창보다 DOM 앞에 있어도 위에 그려지게 z-20 이다.
 */
function Pointer({
  tone,
  tilt,
  delay,
  arrow,
  className,
  children,
}: {
  tone: "pop" | "white";
  tilt: number;
  delay: number;
  /** 화살표 기울기(°). 0 이면 오른쪽 위로 22° 오른다. */
  arrow: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative z-20 mt-4 mr-2 ml-auto w-fit lg:mr-0", className)}>
      <Sticky tone={tone} size="md" tilt={tilt} anim="reveal" delay={delay}>
        {children}
      </Sticky>
      <Scribble
        kind="arrow"
        draw="reveal"
        delay={delay + 200}
        rotate={arrow}
        className="absolute top-1/2 left-[calc(100%+4px)] hidden h-[32px] w-[52px] -translate-y-1/2 lg:block"
      />
    </div>
  );
}

/* ── 내 에이전트 ──────────────────────────────────────────────────────── */

const ISSUE = "온보딩 이탈 로그 수집 초안";
/** 승인 카드 요약 = 도구가 만든 한 줄(heymoa-ai `summarize_create_issue`). */
const CALL = `Linear 이슈 만들기 · ${ISSUE}`;

/** 승인 인자 한 줄(`ApprovalArgs`). 키는 도구가 쓰는 이름 그대로다. */
function Arg({ k, className, children }: { k: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-0.5 sm:flex-row sm:gap-3", className)}>
      <dt className={cn("shrink-0 text-[11px] leading-5 font-medium sm:w-20", APP.muted)}>{k}</dt>
      <dd className={cn("m-0 min-w-0 flex-1 text-xs leading-5 break-words", APP.body)}>
        {children}
      </dd>
    </div>
  );
}

/**
 * 승인 카드(`ApprovalPrompt`, 기다리는 상태). 승인 · 거절은 그림(`span`)이다. 앱의 카드 테두리(둥근 16 ·
 * hairline)는 위 hairline 하나로 줄였다(화면 규칙 5) — 아래쪽은 입력창의 위 hairline 이 가른다.
 */
function ApprovalCard({ className }: { className?: string }) {
  return (
    <div className={cn("border-t border-[var(--el-hairline)] pt-3.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("m-0 min-w-0 flex-1 text-sm leading-relaxed break-keep", APP.ink)}>
          {CALL}
        </p>
        <span
          className={cn(
            "inline-flex h-5 shrink-0 items-center gap-1 rounded-[6px] px-2 text-xs font-medium whitespace-nowrap",
            APP.chipBg,
            APP.ink
          )}
        >
          <PencilLine aria-hidden className="size-3" />
          쓰기 도구
        </span>
      </div>
      {/* 앱은 hairline 테두리도 두르지만 창 안 겹친 액자가 돼서 채움만 남긴다(화면 규칙 5). */}
      <dl className="m-0 mt-3 flex flex-col gap-1.5 rounded-[10px] bg-[var(--el-canvas-soft)] px-3 py-2.5">
        <Arg k="title">{ISSUE}</Arg>
        {/* 단계 1 본문이 「제목과 설명까지」라고 말하므로 모바일에서도 둘 다 보인다. */}
        <Arg k="description">3차 스프린트 킥오프(9월 1일)에서 나온 할 일입니다.</Arg>
      </dl>
      <div className="mt-3 flex gap-2">
        <span
          className={cn(
            "relative inline-flex h-[30px] items-center rounded-[8px] px-2.5 text-[0.8rem] font-medium",
            APP.primary
          )}
        >
          승인
          <Cursor className={CURSOR_AT} />
        </span>
        <span
          className={cn(
            "inline-flex h-[30px] items-center rounded-[8px] border bg-[var(--el-canvas)] px-2.5 text-[0.8rem] font-medium",
            APP.line,
            APP.ink
          )}
        >
          거절
        </span>
      </div>
      <p className={cn("m-0 mt-2 text-[11px] leading-relaxed break-keep", APP.muted)}>
        답할 때까지 기다립니다. 그만두려면 「중지」를 누르세요.
      </p>
    </div>
  );
}

/** 생각 과정의 끝난 줄(`StepRow` — 체크 + 회색 12px). */
function StepDone({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <Check aria-hidden className={cn("mt-[3px] size-3 shrink-0", APP.muted)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * 범위 칩 — 앱 그대로 한 줄 말줄임. 줄바꿈되게 풀었더니 320 에서 칩 상자 안 글자가 두 줄로 꺾여 앱에
 * 없는 칩 모양이 됐다. 입력창 상자를 걷어(화면 규칙 5) 상자 안 여백 28px 이 돌아왔고, 좁은 화면에서는 면을
 * 화면 끝까지 깔아 창이 40px 넓어져서 320 에서도 칩이 다 든다.
 */
const CHIP = <ScopeChip title="3차 스프린트 킥오프" />;

/**
 * 좁은 창(창 폭 320 미만 = 화면 약 360 미만)의 레일 머리 부제 「나만 보는 대화 · 현재 회의 범위」는 말줄임
 * 「현재 회의 …」로 잘린다 → 숨긴다. 부제는 `RailHead` 의 유일한 `truncate` 자식이다. 창 폭으로 가르므로
 * 이 창들은 `@container` 다.
 */
const NARROW_HEAD = "@max-xs:[&>.truncate]:hidden";

/**
 * 입력창(`Composer`)의 상자를 걷는다 — 위 hairline 하나 + 칩 · ■ 한 줄(화면 규칙 5). 상자 안 좌우 여백도
 * 걷어 칩이 본문 글자와 같은 줄에서 시작한다.
 */
const DOCKED = "rounded-none border-0 border-t border-[var(--el-hairline)] px-0 pt-3 pb-0";

/**
 * 색 면. 좁은 화면(sm 미만)에서는 기둥 여백(-mx-5)을 상쇄해 화면 끝까지 깔고 모서리를 편다 — 면 가장자리가
 * 창 양옆 20px 에 평행하게 남으면 색 띠가 창의 두 번째 테두리로 읽혔다. 출입증의 홈은 화면 끝에 반쯤
 * 걸친다(`landing.tsx` 의 overflow-x-clip). sm 부터는 면 안쪽 여백 32 · 40 으로 창과 넉넉히 띄운다.
 * 화면 끝까지 깔아도 면의 **아래** 끝은 남는다 — 내 에이전트 컷 ② 바닥 20px 아래에서 곧은 선으로 끝나 창이
 * 버터 쟁반에 끼운 액자로 읽혔다. 그래서 내 에이전트 타일은 좁은 화면 바닥 여백을 48 로 둔다(`AgentTile`).
 */
const FACE = cn(RADIUS.face, "max-sm:-mx-5 max-sm:rounded-none");

/** 좁을 때 단계와 컷이 같은 560 기둥에 선다. 넓을 때는 격자 칸이 정한다. */
const COL = "mx-auto w-full max-w-[560px] lg:mx-0 lg:max-w-none";

function AgentTile() {
  return (
    <Reveal className={cn("relative bg-[var(--tv-butter)] p-5 pb-12 sm:p-8 lg:p-10", FACE)}>
      {/*
        좁을 때: 머리 → 단계 1 → 컷 1 → 단계 2 → 컷 2 로 쌓인다.
        넓을 때: 2행 격자. 1행 = 머리 + 단계 1 | 컷 1, 2행 = 단계 2 | 컷 2. 두 컷은 겹치지 않고 만화 칸처럼
        36px 띄운다 — 걸쳐 앉히면 기울기가 엇갈려 ① 의 모서리가 ② 옆으로 삐져나와 실수처럼 보였다.
        컷 2 번호표(창 위 16px 밖)도 이 틈 안에 선다.
      */}
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-12 lg:gap-y-9">
        <div className="flex flex-col">
          {/*
            섹션 리드는 두 타일이 무엇을 하는지 가르지 않는다(가르면 「만들어 줌 ↔ 가져감」이 쓰기 · 읽기
            대비로 읽힌다). 이슈 이야기는 이 본문에만 둔다 — 회의를 묻던 대화에서 그대로 부탁한다는 것,
            연동은 워크스페이스 것이라도 만들 때마다 묻는다는 것, 할 일이 저절로 넘어가지 않는다는 것.
          */}
          <TileHead icon={Sparkles} label="내 에이전트" title="승인한 것만 나갑니다">
            회의 내용을 묻던 대화에서 그대로 Linear나 GitHub 이슈도 부탁할 수 있습니다. 워크스페이스에
            연동돼 있어도 만들 때마다 나에게 먼저 묻고, 회의에서 정리된 할&nbsp;일도 저절로 넘어가지
            않습니다.
          </TileHead>
          {/*
            넓을 때 왼쪽 열은 컷 1 바닥에 맞춰 아래에서부터 선다(컷 1 은 `self-end`). 승인 카드 아래(입력창 ·
            안내 한 줄)는 폭과 상관없이 높이가 일정해서 바닥 기준이 흔들리지 않는다.
            - 쪽지 가운데 = 「승인」 높이: 바닥에서 150px(여백 20 + 안내 16 + 8 + 입력창 줄 49 + 16 + 카드 안내
              18 + 8 + 버튼 절반 15), 창이 -1.5° 기울어 왼쪽이 6px 내려와 144px.
            그래서 쪽지(높이 약 34) 아래 끝은 바닥에서 127px 에 선다(lg:mb-[127px]).
            예전엔 그 아래를 손글씨 「기다리는 동안엔 입력창도 잠겨요」가 채웠는데, 화살이 가리키는 앱 줄
            「승인을 기다리는 동안에는 입력할 수 없습니다.」를 그대로 되풀이해서 뺐다. 창 아래쪽(칩 · ■ ·
            그 줄)은 창이 이미 다 말하고 있어 새로 할 말이 없다.
            쪽지도 「누르기 전엔 Linear가 몰라요」는 제목 · 본문과 같은 말(승인 전엔 안 나감)이라, 같은 버튼 줄의
            다른 쪽 — 거절도 기록이 남는다(`chain-of-thought.tsx` 의 「거절함」 줄) — 으로 바꿨다.
          */}
          <Step
            n={1}
            title="승인 카드가 먼저 뜹니다"
            className={cn(COL, "mt-8 lg:mt-auto lg:mb-[127px]")}
            note={
              <Pointer tone="pop" tilt={-4} delay={750} arrow={22}>
                거절해도 「거절함」으로 남아요
              </Pointer>
            }
          >
            어디에 무엇을 만들지 제목과 설명까지 보여 주고, 내가 고를 때까지 기다립니다.
          </Step>
        </div>

        {/* ① 승인 카드가 뜬 대화. */}
        <figure
          className={cn("tv-rslide relative m-0", COL, "mt-6 lg:mt-0 lg:self-end")}
          style={vars({ "--d": "100ms" })}
        >
          <figcaption className="sr-only">
            그림 1(예시): 회의록 「3차 스프린트 킥오프」 옆 내 에이전트 대화. 「온보딩 이탈 로그 수집,
            Linear 이슈로 만들어 줘」라고 하자 에이전트가 만들지 물으며 Linear 이슈 만들기 승인 카드가
            뜹니다. 승인을 누르기 전에는 아무것도 나가지 않고, 그동안 입력창은 잠깁니다. 거절해도 대화에
            「거절함」으로 기록이 남습니다.
          </figcaption>
          <div className="relative -rotate-1 lg:-rotate-[1.5deg]">
            <PanelNo n={1} />
            <ExampleStamp className="absolute -top-4 -right-2 z-10" />
            <AppWindow className="@container">
              <RailHead className={NARROW_HEAD} />
              <div className="px-4 pt-4 pb-5 sm:px-5 sm:pt-5">
                <UserBubble chip={CHIP}>온보딩 이탈 로그 수집, Linear 이슈로 만들어&nbsp;줘</UserBubble>
                <Answer className="mt-4">
                  이 할 일로 Linear 이슈를 만들까요? 아래 내용을 보고 승인해 주세요.
                </Answer>
                {/* 앱은 카드를 바로 위 본문 쪽으로 당긴다(-mt-2). 구분선이 서므로 본문과 12px 만 띄운다. */}
                <ApprovalCard className="mt-3" />
                <Composer chip={CHIP} busy className={cn("mt-4", DOCKED)} />
                <p className={cn("m-0 mt-2 text-xs break-keep", APP.muted)}>
                  승인을 기다리는 동안에는 입력할 수 없습니다.
                </p>
              </div>
            </AppWindow>
          </div>
        </figure>

        {/*
          단계 2 는 컷 2 와 같은 행 머리에 선다. 위 12px 은 쪽지 가운데를 「열어 보기」 높이(창 머리에서
          약 141px)에 맞춘 것이다. 쪽지는 컷 2 왼쪽 빈자리(칸의 16%)까지 나가고, 화살 끝은 1024~1440 모두
          컷 2 본문 여백(20px) 안에서 멈춘다.
          제목은 예전 「승인하면 그때 만듭니다」가 타일 제목과 같은 말이라, 본문이 하던 말(남는다)을 올렸다.
          본문은 그 기록이 어디 있는지 — 끝난 「생각 과정」은 접혀 있다(`chain-of-thought.tsx`) — 를 말한다.
        */}
        <Step
          n={2}
          title="만든 이슈는 대화에 남습니다"
          className={cn(COL, "mt-12 lg:mt-0 lg:pt-3")}
          note={
            <Pointer tone="white" tilt={3} delay={1100} arrow={22} className="lg:-mr-[88px]">
              Linear로 바로 가요
            </Pointer>
          }
        >
          「생각 과정」을 펼치면 이슈 링크와 「승인함」 기록이 있습니다.
        </Step>

        {/*
          ② 승인한 뒤 — 같은 레일을 조금 뒤에 다시 본 컷. 좁을 때는 ① 과 같은 폭(기둥 꽉 차게)에 기울기만
          반대로 준다 — 88% 로 오른쪽에 밀었더니 왼쪽에 빈 띠가 생기고 레일 머리가 더 일찍 잘렸다. 넓을 때만
          84% 로 오른쪽에 붙여 단계 2 쪽지가 들어갈 자리를 남긴다.
        */}
        <div className={cn(COL, "mt-6 lg:mt-0")}>
          <figure
            className="tv-rslide relative m-0 ml-auto w-full lg:w-[84%]"
            style={vars({ "--d": "450ms" })}
          >
            <figcaption className="sr-only">
              그림 2: 승인한 뒤 같은 대화의 생각 과정. 만든 이슈 ONB-12의 링크와 「열어 보기」,
              「승인함」 줄이 남아 있습니다.
            </figcaption>
            <div className="relative rotate-1 lg:rotate-[1.5deg]">
              <PanelNo n={2} />
              <AppWindow className="@container">
                <RailHead className={NARROW_HEAD} />
                <div className="p-4 sm:p-5">
                  <div className="border-l border-[var(--el-hairline-strong)] pl-3.5">
                    <span className="-ml-1 flex items-center gap-1.5 py-0.5">
                      <ChevronRight
                        aria-hidden
                        className={cn("size-3.5 shrink-0 rotate-90", APP.muted)}
                      />
                      <span className={cn("text-xs", APP.muted)}>생각 과정</span>
                    </span>
                    <div className="space-y-1.5 pt-1.5 pb-0.5">
                      <StepDone>
                        <p className={cn("m-0 text-xs leading-relaxed break-keep", APP.muted)}>
                          {CALL} · ONB-12 이슈를 만들었습니다: https://linear.app/…
                        </p>
                        <span
                          className={cn(
                            "relative mt-1 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2",
                            APP.ink
                          )}
                        >
                          열어 보기
                          <ExternalLink aria-hidden className="size-3" />
                          <Scribble
                            kind="circle"
                            draw="reveal"
                            delay={1300}
                            className="absolute -top-1.5 -left-2.5 h-[calc(100%+12px)] w-[calc(100%+20px)]"
                          />
                        </span>
                      </StepDone>
                      <StepDone>
                        <p className={cn("m-0 text-xs leading-relaxed break-keep", APP.muted)}>
                          <span className="font-medium text-[var(--el-body-strong)]">승인함</span>
                          {` · ${CALL}`}
                        </p>
                      </StepDone>
                    </div>
                  </div>
                </div>
              </AppWindow>
            </div>
          </figure>
        </div>
      </div>
    </Reveal>
  );
}

/* ── 외부 에이전트 연결 ───────────────────────────────────────────────── */

/** 사용 내역(최근 것부터). `wide` 는 모바일에서 추리는 줄. */
const USAGE = [
  { at: "9월 3일 오후 4:12", tool: "화면 열기", n: 1 },
  { at: "9월 3일 오후 4:12", tool: "회의 전사", n: 8 },
  { at: "9월 3일 오후 4:11", tool: "회의 목록", n: 3, wide: true },
  { at: "9월 3일 오후 4:11", tool: "프로젝트 항목 목록", n: 6, wide: true },
  { at: "9월 3일 오후 4:11", tool: "연결 확인", n: 1 },
] as const;

/**
 * 출입증 꼬리의 도장. 실제 글자다. 연결이 닿는 범위(맡긴 워크스페이스 하나 · 내가 볼 수 있는 것)와 끝(90일)만
 * 말한다 — 회수는 앞면 쪽지가 말한다. 전의 「아무것도 안 바꿈」은 타일을 쓰기 · 읽기로 가르던 말이라 뺐다.
 * 88px 원 안에서 「워크스페이스」(12px 약 62px)가 한 줄에 든다.
 */
const STAMPS = [
  { text: "워크스페이스 하나만", tilt: -8, place: "lg:self-start" },
  // 「내가 보는 만큼만」은 줄인 말이라 뜻이 안 읽혔다 — 연결한 사람이 볼 수 없는 프로젝트 · 회의는 도구도 못 본다.
  // 줄은 「내가 볼 수 / 있는 것만」에서만 갈리게 묶는다(1440 에서 「…있는 / 것만」으로 한 낱말이 떨어졌다).
  { text: "내가\u00a0볼\u00a0수 있는\u00a0것만", tilt: 6, place: "lg:-mt-2 lg:self-end" },
  { text: "90일 안 쓰면 만료", tilt: -4, place: "lg:-mt-2 lg:self-start" },
] as const;

/**
 * 설정 「외부 에이전트」의 연결 한 줄(`DelegationRow`, 사용 내역 펼침). 앱에서는 테두리 상자지만 창 안에
 * 이것 하나뿐이라 창 테두리 안쪽에 또 테두리가 서서 겹친 액자로 읽혔다 — 상자를 걷고 위 hairline 하나로
 * 머리와 가른다(화면 규칙 5). 사용 내역은 앱처럼 `border-t` 로 가른다.
 */
function DelegationRow() {
  return (
    <div className="@container mt-5 border-t border-[var(--el-hairline)] pt-4">
      <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:justify-between @lg:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--el-canvas-soft)]">
            <Bot aria-hidden className={cn("size-4", APP.muted)} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("m-0 truncate text-sm font-medium", APP.ink)}>노트북 Claude Code</p>
              <span
                className={cn(
                  "inline-flex h-5 items-center rounded-[6px] px-2 text-xs font-medium",
                  APP.success
                )}
              >
                연결됨
              </span>
            </div>
            <p className={cn("m-0 mt-1 text-xs", APP.muted)}>
              제품팀 · <span className="font-mono">hm_k4Tz9Wq…</span>
            </p>
            {/*
              앱 문구 그대로를 덩어리마다 줄바꿈 없이 묶는다 — 좁은 화면에서 「만료」 한 낱말만 다음 줄로
              떨어지지 않고, 「·」 가 줄 머리에 오지 않는다(앞 공백은 줄바꿈 없는 공백).
            */}
            <p className={cn("m-0 mt-0.5 text-xs", APP.muted)}>
              <span className="whitespace-nowrap">2026년 9월 1일 연결</span>&nbsp;·{" "}
              <span className="whitespace-nowrap">최근 사용 2026년 9월 3일</span>&nbsp;·{" "}
              <span className={cn(PEN, APP.ink)} style={vars({ "--d": "900ms" })}>
                <span className="whitespace-nowrap">2026년 12월 2일까지</span>{" "}
                <span className="whitespace-nowrap">쓰지 않으면 만료</span>
              </span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end @lg:self-auto">
          <span
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-xs font-medium",
              APP.ink
            )}
          >
            사용 내역
            <ChevronDown aria-hidden className="size-3.5 rotate-180" />
          </span>
          <span className="relative inline-flex h-8 items-center rounded-[8px] bg-[var(--el-error)]/10 px-2.5 text-[0.8rem] font-medium text-[var(--el-error-strong)]">
            회수
            <Cursor className={CURSOR_AT} />
          </span>
        </div>
      </div>
      <div className="mt-4 border-t border-[var(--el-hairline)] pt-3">
        <ul className="m-0 list-none space-y-1 p-0">
          {USAGE.map((use) => (
            <li
              key={`${use.at}-${use.tool}`}
              className={cn(
                "items-center gap-3 py-1 text-xs",
                "wide" in use ? "hidden sm:flex" : "flex"
              )}
            >
              {/* 좁을 때는 시각 칸을 글자 폭만큼만 둔다(시각이 모두 같은 폭이라 도구 칸이 줄을 맞춘다). */}
              <span className={cn("shrink-0 tabular-nums @sm:w-28", APP.muted)}>{use.at}</span>
              {/* 도구 이름은 짧은 고정 낱말이라 말줄임 대신 통째로 둔다. */}
              <span className={cn("whitespace-nowrap", APP.ink)}>{use.tool}</span>
              <span className={cn("shrink-0 tabular-nums", APP.muted)}>{use.n}건</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 뜯는 선 끝의 홈 — 섹션 바탕(흰색)과 같은 색이라 뚫린 것처럼 보인다. */
function Notch({ className }: { className: string }) {
  return <span aria-hidden className={cn("absolute size-7 rounded-full bg-white", className)} />;
}

function ExternalTile() {
  return (
    <Reveal className={cn("relative flex flex-col bg-[var(--tv-mint)] lg:flex-row", FACE)}>
      {/* 앞면 */}
      <div className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">
        <TileHead
          icon={Plug}
          label="외부 에이전트 연결"
          title="AI 도구에 연결하면 지난 회의를 찾아봐 줍니다"
          bodyClassName="lg:max-w-[560px]"
        >
          {/*
            처음 보는 사람이 읽는 말로 쓴다 — 「워크스페이스 · 스크립트 · 주소를 건넨다 · 회수」 같은 앱 안 낱말을
            쓰지 않는다(전에 「내가 만들고, 언제든 회수할 수 있습니다」 · 「만들 때 고른 워크스페이스의 … 회의
            스크립트를 가져다 쓰고, HeyMoa 화면으로 가는 주소를 건네줍니다」가 어렵다는 말을 들었다). 사실은 MCP
            도구 그대로다: 프로젝트 항목 · 열린 할 일 · 회의 목록 · 회의 스크립트를 찾아보고, 화면 열기
            (`ScreenTools.open_screen`)는 주소만 돌려준다 — 그래서 「화면을 열어 준다」가 아니라 「링크를 알려 준다」.
            「끊는다」는 설정 화면의 「회수」다(창 안 버튼 · 아래 쪽지가 그 낱말을 그대로 쓴다).
          */}
          Claude&nbsp;Code나 Codex 같은 AI 도구에 HeyMoa를 연결해 두면, 일하다가 회의에서 정한 것 ·
          할&nbsp;일 · 회의 기록을 그 자리에서 찾아보고 필요한 HeyMoa 화면 링크도 알려 줍니다. 연결은 직접 만들고,
          언제든 끊을 수 있습니다.
        </TileHead>

        <figure className="relative m-0 mt-8 lg:mt-9">
          <figcaption className="sr-only">
            그림: 설정의 내 MCP 연결 화면에 있는 연결 한 줄(예시). 노트북 Claude Code가 연결됨
            상태이고, 펼친 사용 내역에는 언제 무엇을 몇 건 가져갔는지가 남습니다. 회수를 누르면
            다음 요청부터 막히고 되돌릴 수 없습니다.
          </figcaption>
          <div className="tv-rslide relative" style={vars({ "--d": "100ms" })}>
            <ExampleStamp className="absolute -top-3 -left-2 z-10" />
            <AppWindow className="@container rotate-[0.6deg] p-4 sm:p-5 lg:rotate-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="m-0 font-serif text-[24px] leading-tight font-light tracking-[-0.03em] @md:text-3xl">
                    내 MCP 연결
                  </p>
                  <p className={cn("m-0 mt-2 hidden text-sm break-keep @md:block", APP.muted)}>
                    Claude·ChatGPT 같은 AI 앱이 내가 맡긴 워크스페이스의 회의와 프로젝트를 읽을 수
                    있게 연결합니다.
                  </p>
                </div>
                <span
                  className={cn(
                    "hidden h-8 shrink-0 items-center rounded-[8px] px-2.5 text-[0.8rem] font-medium @md:inline-flex",
                    APP.primary
                  )}
                >
                  새 연결
                </span>
              </div>
              <DelegationRow />
            </AppWindow>
            {/*
              창 오른쪽 아래 모서리에 붙인 쪽지. 창과 겹치는 것은 10px(+ 기울기로 왼쪽 끝이 4~5px 더)뿐이라
              창 아래 여백(16~20px) 안에서 멈추고 마지막 사용 내역 줄을 덮지 않는다.
            */}
            <Sticky
              tone="peach"
              size="md"
              tilt={-3}
              anim="reveal"
              delay={1000}
              className="absolute top-[calc(100%-10px)] right-3 w-[min(248px,80%)] sm:right-6 sm:w-[224px]"
            >
              회수를 누르면 다음 요청부터 막혀요. 되돌릴 수 없어요.
            </Sticky>
          </div>
          <div aria-hidden className="mt-7 hidden items-end gap-1 pl-14 lg:flex">
            <Scribble kind="arrow" draw="reveal" delay={1200} rotate={-68} className="h-[32px] w-[50px]" />
            <Hand>언제 무엇을 몇 건 가져갔는지 남아요</Hand>
          </div>
          {/* 쪽지가 창 아래로 삐져나온 만큼 자리를 둔다(모바일 · 태블릿). */}
          <div aria-hidden className="h-14 lg:hidden" />
        </figure>
      </div>

      {/* 꼬리 — 뜯는 선 + 도장 셋 */}
      <div className="relative flex shrink-0 flex-col items-center gap-4 border-t-2 border-dashed border-[var(--tv-mint-deep)] px-5 pt-7 pb-8 lg:w-[248px] lg:justify-center lg:gap-6 lg:border-t-0 lg:border-l-2 lg:px-8 lg:py-10">
        <Notch className="-top-[15px] -left-3.5 lg:-top-3.5 lg:-left-[15px]" />
        <Notch className="-top-[15px] -right-3.5 lg:top-auto lg:right-auto lg:-bottom-3.5 lg:-left-[15px]" />
        <p aria-hidden className="m-0 text-center">
          <span className="block text-[12px] font-extrabold tracking-[0.14em] text-[var(--tv-ink)]">
            외부 에이전트 출입증
          </span>
          <span className="mt-0.5 block font-mono text-[11px] text-[var(--tv-muted)]">
            No. hm_k4Tz9Wq…
          </span>
        </p>
        <ul className="m-0 flex list-none flex-wrap justify-center gap-2.5 p-0 lg:w-full lg:flex-col lg:flex-nowrap lg:gap-0">
          {STAMPS.map((stamp, i) => (
            <li
              key={stamp.text}
              className={cn(
                "tv-rpop grid size-[88px] place-items-center rounded-full border-2 border-[var(--tv-brand-deep)]/75 p-2 text-center text-[12px] leading-[1.25] font-extrabold break-keep text-[var(--tv-brand-deep)] lg:size-[104px] lg:text-[13px]",
                stamp.place
              )}
              style={{ rotate: `${stamp.tilt}deg`, ...vars({ "--d": `${500 + i * 160}ms` }) }}
            >
              {stamp.text}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

/* ── 구간 ─────────────────────────────────────────────────────────────── */

export function Safety() {
  return (
    <section
      id="safety"
      aria-labelledby="safety-title"
      className={`scroll-mt-20 bg-white ${SECTION_Y.white}`}
    >
      <div className={CONTAINER}>
        <Reveal className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-16">
          <h2 id="safety-title" className={H2}>
            회의 내용이{" "}
            <span className={cn(MARKER_REVEAL, "whitespace-nowrap")}>쓰던 도구까지</span> 이어집니다
          </h2>
          <p className={`${LEAD} lg:pt-3`}>
            {/* 두 타일이 무엇을 하는지 가르지 않는다 — 어디서 부르는지만. 승인 · 회수 같은 규칙은 각 타일이 말한다. */}
            HeyMoa 안의 내 에이전트도, 연결해 둔 Claude&nbsp;Code · Codex도 회의를 보고 일합니다.
          </p>
        </Reveal>

        {/* 트랙을 0 까지 줄 수 있게 둔다 — auto 트랙이면 창의 최소 폭이 타일을 320 화면 밖으로 민다. */}
        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-6 lg:mt-14">
          <AgentTile />
          <ExternalTile />
        </div>
      </div>
    </section>
  );
}
