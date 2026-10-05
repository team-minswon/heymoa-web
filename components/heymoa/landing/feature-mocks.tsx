import {
  ArrowUp,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  PencilLine,
  SkipForward,
  Sparkles,
  Users,
} from "lucide-react";

import { PersonAvatar } from "@/components/heymoa/person-avatar";
import { FACE_KEY } from "@/components/heymoa/landing/shell";
import { TimelineToneIcon } from "@/components/notes/timeline-tone-icon";
import { unnamedSpeakerAvatarKey } from "@/lib/people/avatar-key";

/**
 * 「기능 소개」 카드 여섯이 저마다 품는 앱 화면 조각.
 *
 * **시안이 아니라 실제 앱을 따른다.** 이 랜딩의 전제가 「사실 대조판」이라, 목업이 앱과
 * 어긋나면 목업이 틀린 것이다. 앱 화면의 해부를 카드 크기로 줄여 그린다 — 스크립트는 두 칸
 * 격자, 타임라인은 안건 머리 아래 `시각 | 모양 | 내용`, 검토는 세리프 제목 아래 결정 · 할 일
 * 줄, 챗은 오른쪽 정렬 말풍선이다.
 *
 * **얼굴과 모양은 앱 컴포넌트를 그대로 쓴다.** 얼굴은 `PersonAvatar`(사진이 없으면 `beam`,
 * 글자를 얹지 않는다), 유형 모양은 `TimelineToneIcon`이다. 따로 그리면 앱이 바뀔 때 여기만
 * 남는다 — 글자 원이 실제로 그렇게 남아 있었다.
 *
 * **승인 카드가 가장 많이 틀렸었다.** 앱은 도구 id(`linear.create_issue`)를 제목으로
 * 쓰지 않는다 — 그 자리에는 사람 말 요약이 들어가고, 「쓰기 도구」 배지는 요약 **오른쪽**에
 * 선다(`chat-thread.tsx`의 `ApprovalPrompt`). 인자는 그 아래 `dl`로 붙는다.
 *
 * **여기 글자는 전부 삽화다.** `--lp-faint`(2.2:1)를 쓰는 것은 앱 화면의 흐린 보조
 * 텍스트를 따라 그리기 때문이고, 페이지가 직접 하는 말이 아니다.
 */

/** 창의 안쪽 여백. 여섯이 모두 같다 — 앱의 노트 패널이 그렇다. */
const WINDOW = "flex h-full flex-col px-3 py-[11px]";


/** 지금 회의. 히어로 시연과 같은 회의라 제목도 같다. */
const MEETING = "3차 스프린트 킥오프";
/** 결제 화면 개편을 처음 미룬 앞 회의. 히어로의 `EARLIER`와 같은 노트 제목이다. */
const EARLIER = "2차 스프린트 킥오프";

/**
 * 실시간 스크립트 — 회의가 **끝난 뒤의** 스크립트 탭(`note-archive.tsx`).
 *
 * 회의 중 스크립트에는 화자 칸이 없다 — 화자는 회의가 끝나고 분리된 뒤에야 붙는다. 이 카드의
 * 불릿 둘(화자 · 복사)이 말하는 화면이 이쪽이라 끝난 뒤를 그린다. 한 줄은 아직 이름을 안 붙인
 * 「화자 C」로 두어 「눌러서 붙인다」가 보이게 하고, 그래서 도구줄에 「미지정 1」이 선다.
 *
 * 줄은 히어로 대본(`use-demo.ts`의 `TRANSCRIPT`)에서 문장 단위로만 덜어 온다. 문장 가운데를
 * 빼면 다른 말이 된다. 00:44는 미룬 이유를 **에이전트**에게 보낸다 — 타임라인 항목의 근거는
 * 이 회의 발화뿐이라 펼쳐도 이유가 없고, 이유는 에이전트가 2차 회의록을 읽어야 나온다.
 */
export function TranscriptPane() {
  const lines: Array<[string, string | null, string]> = [
    ["00:31", null, "저는 이번에 합류해서 그 맥락을 모릅니다."],
    ["00:44", "김민서", "에이전트한테 물어보면 2차 회의록에서 찾아 줘요."],
    ["01:02", "정우재", "온보딩 이탈 로그 수집은 제가 맡겠습니다."],
  ];
  return (
    <div className={WINDOW}>
      <div className="flex items-center justify-end gap-1">
        <span className="flex items-center gap-1 px-1.5 py-[3px]">
          <Users aria-hidden className="size-2.5 text-[#8a7a6d]" />
          <span className="text-[9.5px] font-medium text-[var(--lp-body)]">화자</span>
        </span>
        <span className="flex items-center gap-1 px-1.5 py-[3px]">
          <SkipForward aria-hidden className="size-2.5 text-[#8a7a6d]" />
          <span className="text-[9.5px] font-medium text-[var(--lp-body)]">미지정 1</span>
        </span>
        <span className="flex items-center gap-1 rounded-[5px] border border-[var(--lp-rule)] px-2 py-[3px]">
          <Copy aria-hidden className="size-2.5 text-[#8a7a6d]" />
          <span className="text-[9.5px] font-medium text-[var(--lp-body)]">복사</span>
        </span>
      </div>
      <ul className="m-0 mt-1 list-none p-0">
        {lines.map(([at, who, text], i) => (
          <li
            key={at}
            className="grid grid-cols-[38px_1fr] gap-3 border-b border-[var(--lp-rule-soft)] py-2.5"
            data-stagger style={{ "--i": i } as React.CSSProperties}
          >
            <span className="pt-px font-mono text-[9.5px] tabular-nums text-[var(--lp-faint)]">
              {at}
            </span>
            <div className="min-w-0">
              {/* `SpeakerChip`의 축소판 — 얼굴 · 이름, 아직 안 붙인 화자는 라벨 + 회색 점. */}
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--lp-muted)]">
                <PersonAvatar
                  name={who ? FACE_KEY[who] : unnamedSpeakerAvatarKey("C")}
                  size={15}
                />
                {who ?? "화자 C"}
                {who ? null : (
                  <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-[var(--lp-faint)]" />
                )}
              </span>
              <p className="m-0 mt-0.5 break-keep text-[11px] leading-[1.6] text-[var(--lp-ink)]">
                {text}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 타임라인 항목 하나. 모양 · 유형 이름 색 · 덧붙는 말이 앱의 `note-timeline.tsx`와 같다. */
type TimelineRow = {
  at: string;
  tone: "decision" | "task" | "open";
  kind: string;
  title: string;
  /** 유형 이름 뒤에 ` · `로 붙는 말 */
  note?: string;
};

/** 유형 이름의 색 — 앱의 `TONE_TEXT`(글자용으로 한 단 진한 역할 색). */
const TONE_INK: Record<TimelineRow["tone"], string> = {
  decision: "text-[var(--lp-role-decision-ink)]",
  task: "text-[var(--lp-role-task-ink)]",
  open: "text-[var(--lp-role-open-ink)]",
};

/**
 * 타임라인 — 본문 「타임라인」 탭, 기록 중(`note-timeline.tsx`).
 *
 * **히어로 시연이 멈추는 끝 화면의 타임라인 그대로다**(`use-demo.ts`의 `TIMELINE`). 같은
 * 회의라 같은 시각에 다른 항목이 서면 위에서 직접 눌러 본 사람이 바로 알아챈다 — 한때 대본에
 * 없는 안건과 철회를 지어 넣어 그렇게 어긋났다. 이 파일은 서버 컴포넌트라 클라이언트 모듈인
 * 그쪽을 import하지 못해 글자를 옮겨 적는다. 저쪽을 고치면 여기도 고친다.
 *
 * 안건으로 묶고 머리에 시간 구간 · 항목 수를 단다. 「논의 중」은 필터가 아니라 기록 중일 때
 * **마지막 안건에만** 붙는 배지다. 첫 안건은 접어 둔다 — 넷(결정 둘 · 답한 질문 · 인사이트)을
 * 다 펴면 244px 창에 「논의 중」 안건이 안 들어가고, 넷 중 몇만 보이는 안건은 앱에 없다.
 * 접기는 앱에서도 안건 머리를 눌러 하는 일이다. 칩의 개수는 접힌 안건까지 센다 — 답한 질문과
 * 인사이트는 「참고」로 내려간다(`timeline.ts`의 `FILTER_OF`).
 *
 * 「철회됨」은 불릿에만 있다. 앱의 사실이지만 이 회의에는 뒤집힌 결정이 없다.
 */
export function TimelineMock() {
  const filters: Array<[string, number, boolean]> = [
    ["전체", 7, true],
    ["결정", 2, false],
    ["할 일", 2, false],
    ["열린 질문", 1, false],
    ["참고", 2, false],
  ];
  /** `rows`가 `null`이면 접힌 안건이다. 그때도 머리의 수는 안에 든 항목을 다 센다. */
  const groups: Array<{
    range: string;
    title: string;
    total: number;
    live: boolean;
    rows: TimelineRow[] | null;
  }> = [
    { range: "00:00 – 01:02", title: "스프린트 우선순위", total: 4, live: false, rows: null },
    {
      range: "01:02 – 지금",
      title: "온보딩 이탈 로그 수집",
      total: 3,
      live: true,
      rows: [
        {
          at: "01:02",
          tone: "task",
          kind: "할 일",
          title: "온보딩 이탈 로그 수집 초안을 목요일까지 올린다",
        },
        { at: "01:19", tone: "task", kind: "할 일", title: "로그 수집 작업을 Linear 이슈로 내보낸다" },
        {
          at: "01:33",
          tone: "open",
          kind: "질문",
          title: "Linear 이슈에 이 회의 결정도 근거로 붙일 수 있나",
          note: "답을 기다리는 중",
        },
      ],
    },
  ];
  return (
    <div className={WINDOW}>
      {/* 고른 칩만 옅은 면으로 칠한다 — 앱은 짙은 알약이 아니다. */}
      <div className="flex items-center gap-2 border-b border-[var(--lp-rule-soft)] pb-2">
        <div className="flex flex-wrap gap-0.5">
          {filters.map(([label, n, on]) => (
            <span
              key={label}
              className={`flex items-center gap-1 rounded-[5px] px-1.5 py-[3px] ${on ? "bg-[var(--lp-rule-soft)]" : ""}`}
            >
              <span
                className={`text-[9px] ${on ? "font-medium text-[var(--lp-ink)]" : "text-[var(--lp-muted)]"}`}
              >
                {label}
              </span>
              <span className="text-[8.5px] tabular-nums text-[var(--lp-faint)]">{n}</span>
            </span>
          ))}
        </div>
        <span className="ml-auto hidden shrink-0 text-[8.5px] text-[var(--lp-faint)] lg:block">
          말이 끝날 때마다 정리됩니다 · 방금 갱신
        </span>
      </div>

      {groups.map((g, gi) => (
        <section key={g.title} className="pt-2" data-stagger style={{ "--i": gi } as React.CSSProperties}>
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-[8.5px] tabular-nums text-[var(--lp-faint)]">{g.range}</span>
            <span className="min-w-0 truncate text-[10.5px] font-semibold text-[var(--lp-ink)]">
              {g.title}
            </span>
            <span className="shrink-0 text-[9px] tabular-nums text-[var(--lp-faint)]">{g.total}</span>
            {/* 펼친 안건만 꺾쇠가 아래를 본다 — 앱의 `!folded && "rotate-90"`. */}
            <ChevronRight
              aria-hidden
              className={`size-2.5 shrink-0 text-[var(--lp-faint)] ${g.rows ? "rotate-90" : ""}`}
            />
            {g.live ? (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-[5px] bg-[var(--lp-success)]/10 px-1.5 py-px text-[8.5px] text-[var(--lp-success-ink)]">
                <span aria-hidden className="size-[5px] rounded-full bg-[var(--lp-success)]" />
                논의 중
              </span>
            ) : null}
          </div>
          {/* 세로선이 묶음을 꿴다(앱 x=63) — 모양 칸 가운데, 흰 원이 그 위에 얹힌다. */}
          {g.rows ? (
            <ol className="relative m-0 mt-0.5 list-none p-0">
              <span aria-hidden className="absolute top-2 bottom-2 left-[47px] w-px bg-[var(--lp-rule)]" />
              {g.rows.map((r) => (
                <li key={r.at} className="grid grid-cols-[34px_26px_minmax(0,1fr)] py-[3px]">
                  <span className="pt-px text-right text-[9px] tabular-nums text-[var(--lp-faint)]">{r.at}</span>
                  <span className="flex justify-center pt-px">
                    <span className="relative inline-flex rounded-full bg-[var(--lp-card)] [&_svg]:size-[13px]">
                      <TimelineToneIcon tone={r.tone} />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`m-0 break-keep text-[10.5px] leading-[1.45] text-[var(--lp-ink)] ${
                        r.tone === "open" ? "" : "font-medium"
                      }`}
                    >
                      {r.title}
                    </p>
                    <p className="m-0 text-[9px] leading-[1.4] text-[var(--lp-muted)]">
                      <span className={TONE_INK[r.tone]}>{r.kind}</span>
                      {r.note ? (
                        <>
                          <span aria-hidden className="mx-1 text-[var(--lp-rule-strong)]">·</span>
                          <span>{r.note}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ))}
    </div>
  );
}

/** 회의록 칩 — 입력창과 말풍선이 같은 모양을 쓴다(앱 `scope-chip.ts`, 바탕 #e5e9e4 · 글자 #366c4f). */
function MeetingChip() {
  return (
    <span className="inline-flex max-w-full items-center gap-0.5 rounded-[4px] bg-[var(--lp-green)]/10 px-1 py-px align-middle text-[9.5px] font-medium text-[var(--lp-green)]">
      <FileText aria-hidden className="size-2.5 shrink-0" />
      <span className="truncate">{MEETING}</span>
    </span>
  );
}

/**
 * 회의 중 질의 — 오른쪽 「내 에이전트」 레일의 한 왕복(`note-agent-rail.tsx`, `components/chat/*`).
 *
 * 질문 말풍선은 **오른쪽**에 붙고 그 턴에 붙인 회의록이 문장 안에 칩으로 선다. 답변에는
 * 말풍선도 이름표도 없다 — 본문 그대로 흐르고, 아래 윗선 뒤에 「참고한 회의록 N개」가 붙는다.
 * 여러 건이면 접힌 채로 오므로(`chain-of-thought.tsx`) 여기는 한 번 눌러 편 뒤를 그린다. 보내고
 * 나면 입력창에 이 회의록 칩이 **다시** 붙는다 — 칩이 있으면 입력창이 비지 않은 것이라
 * placeholder(「@로 프로젝트·회의록을 참조해 물어보세요」)는 안 보인다(`mention-input.tsx`의
 * `data-empty`).
 *
 * **왕복은 히어로 레일의 첫 왕복(`use-demo.ts`의 `SEED`) 글자 그대로다.** 같은 회의에 같은
 * 질문이라 답이 둘이면 안 된다. 참고한 회의록도 그쪽처럼 둘이다 — 붙인 범위인 이 회의를 먼저
 * 찾고(00:14 「지난 회의에서 … 미뤘습니다」), 이유는 앞 회의에서 찾는다. 칩은 앱처럼 노트
 * 제목을 그대로 쓴다. 이 파일은 서버 컴포넌트라 그 클라이언트 모듈을 import하지 못해 옮겨
 * 적는다.
 */
export function ChatAsk() {
  return (
    <div className={`${WINDOW} gap-2`}>
      <div className="flex min-w-0 items-center gap-1.5 border-b border-[var(--lp-rule-soft)] pb-1.5">
        <Sparkles aria-hidden className="size-3 shrink-0 text-[var(--lp-ink)]" />
        <span className="shrink-0 text-[10.5px] font-semibold text-[var(--lp-ink)]">내 에이전트</span>
        <span className="truncate text-[9.5px] text-[var(--lp-faint)]">나만 보는 대화 · 현재 회의 범위</span>
      </div>

      <div className="flex justify-end">
        <p className="m-0 max-w-[85%] rounded-xl bg-[var(--lp-rule-soft)] px-2.5 py-1.5 break-keep text-[10.5px] leading-[1.6] text-[var(--lp-ink)]">
          <MeetingChip /> 결제 화면 개편은 왜 미뤘나요?
        </p>
      </div>

      <div className="flex flex-col">
        <p className="m-0 break-keep text-[10.5px] leading-[1.65] text-[var(--lp-body)]">
          온보딩 이탈 지표를 먼저 보기로 해서 다음 스프린트로 미뤘습니다. 2차 회의에서 정한
          결정이고, 이번 회의에서 그대로 가기로 했습니다.
        </p>
        <div className="mt-1.5 border-t border-[var(--lp-rule)] pt-1.5">
          <span className="-ml-0.5 flex items-center gap-1">
            <ChevronRight aria-hidden className="size-3 shrink-0 rotate-90 text-[var(--lp-muted)]" />
            <span className="text-[9.5px] text-[var(--lp-muted)]">참고한 회의록 2개</span>
          </span>
          <div className="mt-1 flex flex-wrap gap-1">
            {[EARLIER, MEETING].map((title) => (
              <span
                key={title}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--lp-rule-strong)] px-1.5 py-[2px] text-[9px] text-[var(--lp-body)]"
              >
                <FileText aria-hidden className="size-2.5 shrink-0" />
                <span className="truncate">{title}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-1.5 rounded-[7px] border border-[var(--lp-rule-strong)] py-1 pr-1 pl-2">
        <span className="min-w-0 flex-1">
          <MeetingChip />
        </span>
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--lp-ink)]">
          <ArrowUp aria-hidden className="size-3 text-[var(--lp-on-dark)]" />
        </span>
      </div>
    </div>
  );
}

/**
 * 회의 뒤 검토 — 종료 뒤 요약 탭의 검토 문서(`components/notes/review/*`).
 *
 * 요약 보기에는 결정과 할 일만 선다 — 이슈 · 질문 · 참고는 그래프 보기에만 있다. 결정 줄은
 * `채운 체크 · 내용 · 나온 때 칩`, 할 일 줄은 `빈 상자 · 내용 · 담당 · 기한`이다
 * (`review-row.tsx`). 근거 발언은 줄을 펼쳐야 보여서 둘째 결정을 펼친 채로 둔다
 * (`evidence-quotes.tsx`). 아래 떠 있는 막대가 「검토 완료」로 둘을 프로젝트에 올린다
 * (`confirm-bar.tsx`) — 창이 낮으면 글이 막대 뒤로 잘린다. 앱도 막대 뒤로 스며 사라진다.
 */
export function ReviewDoc() {
  return (
    <div className={`${WINDOW} gap-2`}>
      <div className="relative flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-[4px] bg-[var(--lp-rule-soft)] px-1.5 py-px text-[8.5px] font-semibold text-[var(--lp-body)]">
            검토 중
          </span>
          <span className="flex rounded-full bg-[var(--lp-rule-soft)] p-px">
            <span className="rounded-full bg-[var(--lp-card)] px-1.5 text-[8.5px] font-medium text-[var(--lp-ink)] shadow-[0_1px_2px_#33231a14]">
              요약
            </span>
            <span className="px-1.5 text-[8.5px] font-medium text-[var(--lp-muted)]">그래프</span>
          </span>
        </div>
        <p className="m-0 font-serif text-[13px] font-medium tracking-[-0.02em] text-[var(--lp-ink)]">
          {MEETING}
        </p>

        <section data-stagger style={{ "--i": 0 } as React.CSSProperties}>
          <p className="m-0 text-[10px] font-semibold text-[var(--lp-ink)]">
            결정 <span className="ml-0.5 text-[9px] font-normal text-[var(--lp-faint)]">2</span>
          </p>
          <ul className="m-0 mt-1 list-none p-0">
            <li className="flex items-center gap-1.5 border-b border-[var(--lp-rule-soft)] py-1">
              <span className="flex shrink-0 [&_svg]:size-3">
                <TimelineToneIcon tone="decision" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--lp-ink)]">
                온보딩 이탈을 이번 스프린트의 첫 기준선으로 잡습니다.
              </span>
              <span className="shrink-0 rounded-[4px] bg-[var(--lp-canvas)] px-1 text-[8.5px] tabular-nums text-[var(--lp-muted)]">
                00:00
              </span>
            </li>
            <li className="-mx-1 mt-0.5 rounded-[6px] bg-[var(--lp-rule-soft)] px-1 pt-1 pb-1.5">
              <span className="flex items-start gap-1.5">
                <span className="flex shrink-0 pt-px [&_svg]:size-3">
                  <TimelineToneIcon tone="decision" />
                </span>
                <span className="min-w-0 flex-1 break-keep text-[10px] font-semibold text-[var(--lp-ink)]">
                  결제 화면 개편은 다음 스프린트로 미룹니다.
                </span>
                <span className="shrink-0 rounded-[4px] bg-[var(--lp-canvas)] px-1 text-[8.5px] tabular-nums text-[var(--lp-muted)]">
                  00:14
                </span>
              </span>
              <span className="mt-1 ml-[18px] flex gap-1.5 rounded-[6px] border border-[var(--lp-rule)] bg-[var(--lp-card)] px-1.5 py-1">
                <PersonAvatar name={FACE_KEY.박지훈} size={11} className="mt-px" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[8.5px] text-[var(--lp-faint)]">
                    <span className="font-medium text-[var(--lp-body)]">박지훈</span> · 00:14
                  </span>
                  <span className="truncate text-[9.5px] text-[var(--lp-ink)]">
                    지난 회의에서 결제 화면 개편은 다음으로 미뤘습니다.
                  </span>
                </span>
              </span>
            </li>
          </ul>
        </section>

        <section data-stagger style={{ "--i": 1 } as React.CSSProperties}>
          <p className="m-0 text-[10px] font-semibold text-[var(--lp-ink)]">
            할 일 <span className="ml-0.5 text-[9px] font-normal text-[var(--lp-faint)]">2</span>
          </p>
          <div className="mt-1 flex items-center gap-1.5 py-1">
            <span aria-hidden className="size-3 shrink-0 rounded-[3px] border-[1.5px] border-[var(--lp-rule-strong)]" />
            <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--lp-ink)]">
              온보딩 이탈 로그 수집 초안을 올립니다.
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[9px] text-[var(--lp-body)]">
              <PersonAvatar name={FACE_KEY.정우재} size={12} />
              정우재
            </span>
            {/* 히어로 시연과 같은 회의(9월 1일 화요일)라 「이번 주 목요일」은 9월 3일이다. */}
            <span className="flex shrink-0 items-center gap-0.5 rounded-[4px] bg-[var(--lp-canvas)] px-1 py-px text-[8.5px] text-[var(--lp-muted)]">
              <CalendarDays aria-hidden className="size-2.5" />
              9월 3일 (목)
            </span>
          </div>
          <div className="flex items-center gap-1.5 py-1">
            <span aria-hidden className="size-3 shrink-0 rounded-[3px] border-[1.5px] border-[var(--lp-rule-strong)]" />
            <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--lp-ink)]">
              로그 수집 작업을 Linear 이슈로 내보냅니다.
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[9px] text-[var(--lp-body)]">
              <PersonAvatar name={FACE_KEY.박지훈} size={12} />
              박지훈
            </span>
            {/* 기한이 안 정해진 할 일 — 앱은 주황 점선의 「기한 정하기」로 둔다(`DueCell chip`). */}
            <span className="flex shrink-0 items-center gap-0.5 rounded-[4px] border border-dashed border-[#efc2a8] px-1 py-px text-[8.5px] text-[var(--lp-role-open-ink)]">
              <CalendarDays aria-hidden className="size-2.5" />
              기한 정하기
            </span>
          </div>
        </section>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-4 bg-gradient-to-b from-transparent to-[var(--lp-card)] lg:block" />
      </div>

      <div className="flex shrink-0 items-center gap-2 rounded-[9px] border border-[var(--lp-rule)] bg-[var(--lp-card)] py-1 pr-1 pl-2.5 shadow-[0_2px_8px_#33231a14]">
        <span className="min-w-0 flex-1 break-keep text-[9px] leading-[1.4] text-[var(--lp-body)]">
          결정 <b className="font-semibold text-[var(--lp-ink)]">2</b>개와 할 일{" "}
          <b className="font-semibold text-[var(--lp-ink)]">2</b>개를 프로젝트에 올립니다
        </span>
        <span aria-hidden className="h-3.5 w-px shrink-0 bg-[var(--lp-rule)]" />
        <span className="shrink-0 rounded-[6px] bg-[var(--lp-dark)] px-2 py-1 text-[9px] font-semibold text-[var(--lp-on-dark)]">
          검토 완료
        </span>
      </div>
    </div>
  );
}

/**
 * 도구로 내보내기 — 스레드 안의 승인 카드.
 *
 * **도구 id를 제목으로 안 쓴다.** 앱은 그 자리에 AI가 쓴 요약(「Linear 이슈 만들기 · {제목}」)을
 * 넣고, 「쓰기 도구」 배지는 요약 **오른쪽**에 선다. 인자는 아래 옅은 상자 속 `dl`로 붙고 키는
 * `title`처럼 원문 그대로다(`chat-thread.tsx`).
 *
 * **일괄 대기열이 아니다.** 호출 하나마다 뜨는 카드이고 버튼은 「승인」과 「거절」 둘뿐이다.
 */
export function ApprovalThread() {
  return (
    <div className={`${WINDOW} gap-2`}>
      <div className="flex justify-end">
        <p className="m-0 max-w-[85%] rounded-xl bg-[var(--lp-rule-soft)] px-2.5 py-1.5">
          <span className="break-keep text-[10.5px] leading-[1.5] text-[var(--lp-ink)]">
            온보딩 이탈 로그 수집, Linear 이슈로 만들어 줘
          </span>
        </p>
      </div>

      <div className="rounded-[11px] border border-[var(--lp-rule)] bg-[var(--lp-card)] p-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="m-0 min-w-0 flex-1 break-keep text-[10.5px] leading-[1.5] text-[var(--lp-ink)]">
            Linear 이슈 만들기 · 온보딩 이탈 로그 수집 초안
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-[var(--lp-rule-soft)] px-1.5 py-px">
            <PencilLine aria-hidden className="size-2.5 text-[var(--lp-body)]" />
            <span className="text-[8.5px] font-semibold text-[var(--lp-body)]">쓰기 도구</span>
          </span>
        </div>

        <dl className="m-0 mt-2 flex flex-col gap-0.5 rounded-[7px] border border-[var(--lp-rule-soft)] bg-[var(--lp-canvas)] px-2 py-1.5">
          <div className="flex gap-2">
            <dt className="w-11 shrink-0 text-[9px] leading-4 font-medium text-[var(--lp-muted)]">
              title
            </dt>
            <dd className="m-0 min-w-0 flex-1 break-keep text-[9.5px] leading-4 text-[var(--lp-body)]">
              온보딩 이탈 로그 수집 초안
            </dd>
          </div>
        </dl>

        <div className="mt-2.5 flex gap-1.5">
          <span className="rounded-[6px] bg-[var(--lp-accent)] px-3 py-1 text-[10px] font-semibold text-[var(--lp-on-dark)]">
            승인
          </span>
          <span className="rounded-[6px] border border-[var(--lp-rule-strong)] bg-[var(--lp-card)] px-3 py-1 text-[10px] font-medium text-[var(--lp-body)]">
            거절
          </span>
        </div>
        <p className="m-0 mt-1.5 break-keep text-[8.5px] leading-[1.45] text-[var(--lp-faint)]">
          답할 때까지 기다립니다. 그만두려면 「중지」를 누르세요.
        </p>
      </div>
    </div>
  );
}

/**
 * 멤버 초대 — 워크스페이스 설정 › 멤버, 관리자가 본 화면(`members-settings.tsx`).
 *
 * 순서는 머리 → 멤버 목록 → 「멤버 초대」 → 「대기 중인 초대」다. 초대는 멤버 목록에 섞이지
 * 않고 따로 선다 — 「초대함」 같은 상태는 앱에 없다. 관리자가 보는 화면이라 역할 자리는 칩이
 * 아니라 고르는 상자이고, 내가 아닌 행에 「내보내기」가 붙는다. 인원수는 쓰지 않는다.
 */
export function InviteList() {
  const members: Array<[string, string, string, boolean]> = [
    ["김민서", "minseo@example.com", "관리자", true],
    ["박지훈", "jihoon@example.com", "멤버", false],
  ];
  return (
    <div className={WINDOW}>
      <p className="m-0 font-serif text-[12px] font-light tracking-[-0.025em] text-[var(--lp-ink)]">
        멤버
      </p>
      <p className="m-0 mt-0.5 truncate text-[8.5px] text-[var(--lp-muted)]">
        이 워크스페이스의 멤버와 대기 중인 초대를 관리합니다.
      </p>

      <ul className="m-0 mt-2 list-none divide-y divide-[var(--lp-rule-soft)] rounded-[8px] border border-[var(--lp-rule-soft)] p-0">
        {members.map(([who, email, role, me], i) => (
          <li
            key={who}
            data-stagger style={{ "--i": i } as React.CSSProperties}
            className="flex items-center gap-2 px-2 py-1.5"
          >
            <PersonAvatar name={FACE_KEY[who]} size={18} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[10px] font-medium text-[var(--lp-ink)]">
                {who}
                {me ? <span className="ml-1 text-[8.5px] font-normal text-[var(--lp-muted)]">(나)</span> : null}
              </span>
              <span className="truncate text-[8.5px] text-[var(--lp-muted)]">{email}</span>
            </span>
            <span className="flex shrink-0 items-center gap-0.5 rounded-[5px] border border-[var(--lp-rule)] px-1.5 py-0.5 text-[9px] text-[var(--lp-body)]">
              {role}
              <ChevronDown aria-hidden className="size-2.5 text-[var(--lp-faint)]" />
            </span>
            {me ? (
              // 내 행에는 버튼이 없어도 자리는 둔다 — 앱도 그래야 두 줄의 역할 상자가 한 자리에 선다.
              <span className="w-[42px] shrink-0" />
            ) : (
              <span className="w-[42px] shrink-0 rounded-[5px] border border-[var(--lp-rule-strong)] py-0.5 text-center text-[9px] text-[var(--lp-body)]">
                내보내기
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-2.5" data-stagger style={{ "--i": 2 } as React.CSSProperties}>
        <p className="m-0 text-[9.5px] font-medium text-[var(--lp-ink)]">멤버 초대</p>
        <div className="mt-1 flex gap-1">
          <span className="box-border min-w-0 flex-1 truncate rounded-[5px] border border-[var(--lp-rule)] px-2 py-1 text-[9.5px] text-[var(--lp-faint)]">
            name@gmail.com
          </span>
          <span className="flex shrink-0 items-center gap-0.5 rounded-[5px] border border-[var(--lp-rule)] px-1.5 py-1 text-[9.5px] text-[var(--lp-body)]">
            멤버
            <ChevronDown aria-hidden className="size-2.5 text-[var(--lp-faint)]" />
          </span>
          <span className="shrink-0 rounded-full bg-[var(--lp-dark)] px-2.5 py-1 text-[9.5px] font-semibold text-[var(--lp-on-dark)]">
            초대
          </span>
        </div>
      </div>

      <div className="mt-2" data-stagger style={{ "--i": 3 } as React.CSSProperties}>
        <p className="m-0 text-[9.5px] font-medium text-[var(--lp-ink)]">대기 중인 초대</p>
        <div className="mt-1 flex items-center gap-1.5 rounded-[8px] border border-[var(--lp-rule-soft)] px-2 py-1">
          <span className="min-w-0 flex-1 truncate text-[9.5px] font-medium text-[var(--lp-ink)]">
            seoyeon@example.com
          </span>
          <span className="shrink-0 rounded-[4px] border border-[var(--lp-rule)] px-1.5 text-[8.5px] text-[var(--lp-body)]">
            멤버
          </span>
          <span className="shrink-0 rounded-[5px] border border-[var(--lp-rule-strong)] px-1.5 py-px text-[9px] text-[var(--lp-body)]">
            취소
          </span>
        </div>
      </div>
    </div>
  );
}
