import { Check, CircleStop, LoaderCircle, Mic, Pause, Square } from "lucide-react";
import type { ReactNode } from "react";

import {
  CONTAINER,
  Eyebrow,
  SECTION_TOP,
  SECTION_X,
  SectionLead,
  SectionTitle,
} from "@/components/heymoa/landing/shell";

/**
 * 「사용 흐름」. 로그인부터 검토 완료까지 여섯 걸음.
 *
 * **번호가 붙는 자리가 여기다.** 실제로 순서가 있는 절차라서다 — 2를 건너뛰면 3에서
 * 「새 노트」를 누를 곳이 없다. 순서가 아닌 목록에는 번호를 안 붙인다.
 *
 * 리드가 「앱 안에 있는 말 그대로」라고 약속하므로 **컨트롤은 실제 창과 버튼을 옮긴다** —
 * `google-login-button.tsx`, `create-project-dialog.tsx`, `new-meeting-dialog.tsx`,
 * `recording-dock.tsx`, `meeting-controls.tsx` + `review/flow-notice.tsx`,
 * `review/confirm-bar.tsx`. 온보딩 단계 카드의 「회의를 묶는 상자입니다…」는 입력칸이 없는
 * 다른 화면의 말이라 컨트롤에 섞지 않는다(예전에 섞어서 어느 화면과도 안 맞았다).
 *
 * 종착점이 「검토 완료」인 것은 결정과 할 일이 그 버튼을 눌러야 프로젝트에 남아서다(APP-464).
 * 에이전트 승인 카드로 내보내기는 선택 걸음이라 여섯에 넣지 않고 목록 아래 한 줄로 둔다.
 */

type Step = { n: number; title: string; body: string; control: ReactNode };

/** `google-login-button.tsx`의 4색 G를 그대로 옮겼다 — 회색 원 자리표시는 앱에 없는 모양이다. */
function GoogleMark() {
  return (
    <svg className="size-[18px] shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/**
 * 만들기 창의 윗부분 — 제목, 라벨, 흐린 placeholder. 2와 3이 같은 짜임의 창이라 한 벌로 그린다.
 * 라벨은 앱 `Label`처럼 보통 글꼴 medium이다(예전의 mono 라벨은 아트보드에만 있던 모양).
 */
function DialogTop({ title, label, placeholder }: { title: string; label: string; placeholder: string }) {
  return (
    <>
      <p className="m-0 break-keep text-[13.5px] font-bold text-[var(--lp-ink)]">{title}</p>
      <p className="m-0 mt-2.5 mb-1.5 text-[12px] font-medium text-[var(--lp-ink)]">{label}</p>
      <div className="rounded-lg border border-[var(--lp-rule)] px-3 py-2.5">
        <span className="text-[12.5px] text-[var(--lp-muted)]">{placeholder}</span>
      </div>
    </>
  );
}

/** 독의 파형 막대 다섯. 실제로는 마이크 레벨을 따라 움직이지만 여기서는 한 순간을 멈춰 그린다. */
const LEVELS = [6, 11, 16, 9, 4];

/** `flow-notice.tsx`의 단계 줄. 화자 나누기가 끝나고 분석이 도는 순간을 그린다. */
const ANALYSIS_STEPS = ["화자 나누기", "분석", "검토", "확정"] as const;
const ANALYSIS_NOW = 1;

/** 걸음마다 실제로 누르는 컨트롤을 옆에 둔다 — 설명만 있으면 어디를 눌러야 할지 안 보인다. */
const STEPS: Step[] = [
  {
    n: 1,
    title: "Google 계정으로 로그인합니다",
    body: "워크스페이스가 하나 만들어집니다. 설치할 것도, 카드 등록도 없습니다.",
    control: (
      <div className="flex justify-center">
        <span className="flex h-10 items-center gap-2 rounded-full border border-[var(--lp-rule)] bg-[var(--lp-canvas)] pl-3.5 pr-4">
          <GoogleMark />
          <span className="text-[13.5px] font-medium text-[var(--lp-ink)]">Google 로그인</span>
        </span>
      </div>
    ),
  },
  {
    n: 2,
    title: "회의를 담을 프로젝트부터 만듭니다",
    body: "회의는 프로젝트 안에 만들어집니다. 하나만 만들어 두면 바로 회의를 시작할 수 있습니다.",
    control: <DialogTop title="첫 프로젝트 만들기" label="프로젝트 이름" placeholder="주간" />,
  },
  {
    n: 3,
    title: "「새 노트」로 회의를 만듭니다",
    body: "이름을 지어 두면 나중에 찾기 쉽습니다.",
    control: <DialogTop title="새 회의 만들기" label="회의 이름" placeholder="주간 제품 회의" />,
  },
  {
    n: 4,
    title: "기록을 시작합니다",
    /* 「회의 시작」은 시작 버튼의 aria-label일 뿐 화면 글자가 아니다(글자도 툴팁도 없는 빨간 원).
       리드가 「앱 안에 있는 말 그대로」라고 약속했으니 낫표로 인용하지 않고 보이는 모양을 적는다. */
    body: "마이크 권한이 필요합니다. 노트 아래 녹음 독의 빨간 버튼을 누르면 대화가 실시간으로 스크립트에 쌓이고, 남길 만한 결정·할 일·질문은 「타임라인」 탭에 안건별로 모입니다.",
    control: (
      /* 기록 중인 녹음 독. 「기록 중」 글자는 독이 아니라 노트 상단바의 상태 칩에 있어서
         여기 넣지 않는다 — 「마이크 입력」도 화면 글자가 아니라 파형의 aria-label이다. */
      <div className="flex justify-center">
        <span className="flex h-11 items-center rounded-full border border-[var(--lp-rule)] bg-[var(--lp-card)] p-1 shadow-[0_2px_8px_#33231a12]">
          <span className="flex size-9 items-center justify-center text-[var(--lp-muted)]">
            <Mic aria-hidden className="size-4" />
          </span>
          <span aria-hidden className="mx-1 h-5 w-px bg-[var(--lp-rule)]" />
          <span className="flex items-center gap-2 pl-2 pr-1">
            <span className="min-w-12 font-mono text-[13px] font-semibold tabular-nums text-[var(--lp-rec-ink)]">
              01:24
            </span>
            <span aria-hidden className="mx-0.5 flex h-5 w-8 items-center justify-center gap-[3px]">
              {LEVELS.map((h, i) => (
                <span key={i} className="w-[3px] rounded-full bg-[var(--lp-rec)]" style={{ height: h }} />
              ))}
            </span>
            <span className="flex size-9 items-center justify-center text-[var(--lp-faint)]">
              <Square aria-hidden className="size-3.5" />
            </span>
          </span>
        </span>
      </div>
    ),
  },
  {
    n: 5,
    title: "중지하고 회의를 종료합니다",
    body: "기록 중인 회의는 중지한 뒤 종료할 수 있습니다. 종료하면 화자를 나누고 회의를 분석합니다. 몇 분 걸릴 수 있고, 다른 화면으로 옮겨도 됩니다.",
    control: (
      /* 위는 중지한 뒤의 상단바(「중지됨」 칩 + 「회의 종료」), 아래는 종료 뒤 요약 탭의 단계 줄.
         진행 중 단계의 원은 앱에서 돌지만 여기서는 멈춰 둔다 — 랜딩에서는 끝나지 않는 장식이다. */
      <>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--lp-rule-soft)] pb-3">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--lp-muted)]">
            <Pause aria-hidden className="size-3.5" />
            중지됨
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--lp-rec)] px-2.5 text-[12px] font-medium text-[var(--lp-rec-ink)]">
            <CircleStop aria-hidden className="size-4" />
            회의 종료
          </span>
        </div>
        <ol aria-label="분석 단계" className="m-0 mt-3.5 flex list-none flex-wrap items-center gap-2.5 p-0 text-[12px]">
          {ANALYSIS_STEPS.map((label, at) => {
            const done = at < ANALYSIS_NOW;
            const now = at === ANALYSIS_NOW;
            return (
              /* 상태는 체크·스피너 모양으로만 보이는데 그 아이콘은 aria-hidden이다 — 스크린 리더도
                 어디까지 왔는지 알도록 li에 상태를 붙인다(히어로 `Analyzing`, 앱 `flow-notice.tsx`와 같다). */
              <li
                key={label}
                aria-label={`${label}: ${done ? "완료" : now ? "진행 중" : "대기"}`}
                className="flex items-center gap-2.5"
              >
                {/* 좁은 화면에서 선을 빼는 것도 앱과 같다 — 넷을 이으면 350 카드에서 감긴다. */}
                {at > 0 ? (
                  <span
                    aria-hidden
                    className={`hidden h-px w-7 sm:block ${at <= ANALYSIS_NOW ? "bg-[var(--lp-rule-strong)]" : "bg-[var(--lp-rule)]"}`}
                  />
                ) : null}
                <span
                  aria-current={now ? "step" : undefined}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap ${
                    done
                      ? "text-[var(--lp-body)]"
                      : now
                        ? "font-semibold text-[var(--lp-ink)]"
                        : "text-[var(--lp-faint)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                      done
                        ? "border-[var(--lp-ink)] bg-[var(--lp-ink)] text-[var(--lp-card)]"
                        : now
                          ? "border-[var(--lp-rule-strong)] text-[var(--lp-ink)]"
                          : "border-[var(--lp-rule-strong)] text-[var(--lp-faint)]"
                    }`}
                  >
                    {done ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : now ? (
                      <LoaderCircle className="size-3" />
                    ) : (
                      at + 1
                    )}
                  </span>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </>
    ),
  },
  {
    n: 6,
    title: "요약 탭에서 검토하고 완료합니다",
    body: "분석이 끝나면 「요약」 탭에 요약 · 주제 · 결정 · 할 일이 섭니다. 「검토 완료」를 누르면 결정과 할 일이 프로젝트에 확정되고, 할 일은 「할 일」에 모입니다.",
    control: (
      /* 요약 탭 아래에 떠 있는 검토 막대. 고르지 않은 제안이 없을 때의 평소 문구다. */
      <span className="flex min-h-[50px] flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[14px] border border-[var(--lp-rule)] bg-[var(--lp-card)] py-[7px] pr-[7px] pl-[18px] shadow-[0_2px_8px_#33231a12]">
        <span className="break-keep text-[13px] text-[var(--lp-body)]">
          결정 <b className="font-semibold tabular-nums text-[var(--lp-ink)]">2</b>개와 할 일{" "}
          <b className="font-semibold tabular-nums text-[var(--lp-ink)]">2</b>개를 프로젝트에 올립니다
        </span>
        <span aria-hidden className="hidden h-5 w-px bg-[var(--lp-rule)] sm:block" />
        <span className="ml-auto inline-flex h-9 items-center rounded-[9px] bg-[var(--lp-dark)] px-4 text-[13px] font-medium text-[var(--lp-on-dark)]">
          검토 완료
        </span>
      </span>
    ),
  },
];

export function Flow() {
  return (
    <section className={`${SECTION_X} ${SECTION_TOP}`}>
      <div className={CONTAINER}>
        <Eyebrow>사용 흐름</Eyebrow>
        <SectionTitle>로그인부터 검토 완료까지 여섯 걸음</SectionTitle>
        <SectionLead>
          각 걸음에서 실제로 누르는 것을 그대로 옮겼습니다. 아래 문구는 앱 안에
          있는 말 그대로입니다.
        </SectionLead>

        <ol className="m-0 mt-8 list-none p-0 lg:mt-11">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              data-stagger
              style={{ "--i": i } as React.CSSProperties}
              className={`flex flex-col gap-2.5 border-t border-[var(--lp-rule)] py-6 lg:flex-row lg:gap-9 lg:py-[30px] ${
                i === STEPS.length - 1 ? "border-b border-[var(--lp-rule)]" : ""
              }`}
            >
              <span className="w-11 shrink-0 font-mono text-[22px] font-semibold leading-[1.3] tabular-nums text-[var(--lp-muted)] lg:text-[26px] lg:leading-none">
                {s.n}
              </span>
              <div className="shrink-0 lg:w-[470px]">
                <h3 className="m-0 break-keep text-[18px] font-bold tracking-[-0.4px] text-[var(--lp-ink)] lg:text-[20px]">
                  {s.title}
                </h3>
                <p className="m-0 mt-2.5 break-keep text-[15px] leading-[1.75] text-[var(--lp-body)]">
                  {s.body}
                </p>
              </div>
              <div className="box-border mt-1 min-w-0 flex-1 rounded-[10px] border border-[var(--lp-rule)] bg-[var(--lp-card)] p-4 lg:mt-0 lg:px-5 lg:py-[18px]">
                {s.control}
              </div>
            </li>
          ))}
        </ol>

        {/* 내보내기는 걸음이 아니다 — 연동을 켠 워크스페이스에서만, 사람이 승인한 호출로만 일어난다.
            인용한 카드 요약은 AI가 만드는 평서형(`Linear 이슈 만들기 · {제목}`) 그대로다. */}
        <p className="m-0 mt-6 max-w-[640px] break-keep text-[14px] leading-[1.7] text-[var(--lp-muted)] lg:mt-8">
          Linear · GitHub 로 내보내기는 걸음에 넣지 않았습니다. 설정에서 연동을 연결해 두면
          「내 에이전트」에게 시킬 수 있고, 쓰기 전에 「Linear 이슈 만들기 · …」 승인 카드에서
          「승인」을 눌러야만 만들어집니다.
        </p>
      </div>
    </section>
  );
}
