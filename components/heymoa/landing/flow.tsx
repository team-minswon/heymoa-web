import { PencilLine } from "lucide-react";
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
 * 「사용 흐름」. 로그인부터 첫 요약까지 여섯 걸음.
 *
 * **번호가 붙는 자리가 여기다.** 실제로 순서가 있는 절차라서다 — 2를 건너뛰면 3에서
 * 「새 노트」를 누를 곳이 없다. 순서가 아닌 목록에는 번호를 안 붙인다.
 *
 * 걸음 설명은 앱 온보딩 화면(`workspace-onboarding.tsx`)에 있는 말 그대로다. 여기서
 * 새로 지어 쓰면 화면과 랜딩이 갈라진다 — 「회의를 묶는 상자입니다. 팀·제품·고객 단위로
 * 짓습니다」 같은 문장이 그 화면에 실제로 떠 있다.
 */

type Step = { n: number; title: string; body: string; control: ReactNode };

/** 걸음마다 실제로 누르는 컨트롤을 옆에 둔다 — 설명만 있으면 어디를 눌러야 할지 안 보인다. */
const STEPS: Step[] = [
  {
    n: 1,
    title: "Google 계정으로 로그인합니다",
    body: "워크스페이스가 하나 만들어집니다. 설치할 것도, 카드 등록도 없습니다.",
    control: (
      <div className="flex justify-center">
        <span className="flex items-center gap-2.5 rounded-lg border border-[var(--lp-rule-strong)] px-[18px] py-[11px] lg:px-5 lg:py-2.5">
          <span aria-hidden className="size-4 shrink-0 rounded-full bg-[var(--lp-rule)]" />
          <span className="text-[13px] font-semibold text-[var(--lp-ink)] lg:text-[13.5px]">
            Google 계정으로 계속하기
          </span>
        </span>
      </div>
    ),
  },
  {
    n: 2,
    title: "회의를 담을 프로젝트부터 만듭니다",
    body: "회의는 프로젝트 안에 만들어집니다. 하나만 만들어 두면 바로 회의를 시작할 수 있습니다.",
    control: (
      <>
        <p className="m-0 break-keep text-[13.5px] font-bold text-[var(--lp-ink)]">
          프로젝트 만들기
        </p>
        <div className="mt-2.5 rounded-lg border border-[var(--lp-rule)] px-3 py-2.5">
          <span className="text-[12.5px] text-[var(--lp-muted)]">온보딩 개선</span>
        </div>
        <p className="m-0 mt-2 break-keep text-[12px] leading-[1.5] text-[var(--lp-muted)] lg:text-[11.5px]">
          회의를 묶는 상자입니다. 팀·제품·고객 단위로 짓습니다
        </p>
      </>
    ),
  },
  {
    n: 3,
    title: "「새 노트」로 회의를 만듭니다",
    body: "이름을 지어 두면 나중에 찾기 쉽습니다.",
    control: (
      <>
        <p className="m-0 break-keep text-[13.5px] font-bold text-[var(--lp-ink)]">
          새 회의 만들기
        </p>
        <p className="m-0 mt-2.5 mb-1.5 font-mono text-[10.5px] font-semibold tracking-[0.6px] text-[var(--lp-muted)]">
          회의 이름
        </p>
        <div className="rounded-lg border border-[var(--lp-rule)] px-3 py-2.5">
          <span className="text-[12.5px] text-[var(--lp-muted)]">주간 제품 회의</span>
        </div>
      </>
    ),
  },
  {
    n: 4,
    title: "기록을 시작합니다",
    body: "마이크 권한이 필요합니다. 대화가 실시간으로 전사되고, 오른쪽 「실시간 정리」에 남길 만한 항목이 쌓입니다.",
    control: (
      <div className="flex items-center gap-3.5">
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-[var(--lp-dark)] px-4 py-2.5">
          <span aria-hidden className="size-[7px] rounded-full bg-[#e0705a]" />
          <span className="text-[12.5px] font-semibold text-[var(--lp-on-dark)]">기록 중</span>
        </span>
        <span className="font-mono text-[14px] font-semibold tabular-nums text-[var(--lp-ink)]">
          01:24
        </span>
        <span className="flex-1" />
        <span className="text-[12px] text-[var(--lp-muted)]">마이크 입력</span>
        <span aria-hidden className="block h-[5px] w-14 shrink-0 overflow-hidden rounded-full bg-[var(--lp-rule)]">
          <span className="block h-[5px] w-8 bg-[var(--lp-green)]" />
        </span>
      </div>
    ),
  },
  {
    n: 5,
    title: "회의를 종료합니다",
    body: "회의를 종료하면 개요·액션 아이템·결정이 자동으로 정리됩니다. 종료 전에는 「요약」 탭이 안내만 보여 줍니다.",
    control: (
      <>
        {(
          [
            ["개요", "1", "온보딩 이탈을 이번 스프린트의 첫 기준선으로 잡고, 결제 화면 개편은 뒤로 미뤘습니다."],
            ["액션 아이템", "2", "온보딩 이탈 로그 수집 초안을 목요일까지 올립니다."],
          ] as const
        ).map(([label, n, text], i) => (
          <div key={label} className={i > 0 ? "mt-3.5" : ""}>
            <div className="flex items-baseline gap-2.5 border-b border-[var(--lp-rule-soft)] pb-2">
              <span className="font-serif text-[11.5px] font-semibold text-[var(--lp-muted)]">
                {label}
              </span>
              <span className="flex-1" />
              <span className="font-mono text-[11px] tabular-nums text-[var(--lp-muted)]">{n}</span>
            </div>
            <p className="m-0 mt-2.5 break-keep text-[12.5px] leading-[1.6] text-[var(--lp-ink)]">
              {text}
            </p>
          </div>
        ))}
      </>
    ),
  },
  {
    n: 6,
    title: "필요하면 승인하고 내보냅니다",
    body: "에이전트에게 이슈 생성을 시키면 쓰기 전에 승인 카드가 뜹니다. 설정에서 도구를 먼저 연결해 둔 경우에만 쓸 수 있습니다.",
    control: (
      /* 「작동 방식」 카드의 `ApprovalCard`를 쓰지 않는다 — 여기서는 승인 카드가 뜬다는
         사실만 보이면 되고, 호출 줄까지 그리면 걸음 하나가 다른 걸음보다 55px 커진다. */
      <>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lp-rule-soft)] px-[9px] py-1">
          <PencilLine aria-hidden className="size-3 shrink-0 text-[var(--lp-body)]" />
          <span className="text-[11px] font-semibold text-[var(--lp-body)] lg:text-[10.5px]">
            쓰기 도구
          </span>
        </span>
        <p className="m-0 mt-2.5 break-keep text-[13.5px] font-bold text-[var(--lp-ink)] lg:text-[13px]">
          Linear 에 이슈를 만들까요?
        </p>
        <div className="mt-3 flex gap-2 lg:mt-2.5">
          <span className="rounded-lg bg-[var(--lp-dark)] px-4 py-2 text-[12px] font-semibold text-[var(--lp-on-dark)] lg:px-[15px] lg:py-[7px] lg:text-[11.5px]">
            승인
          </span>
          <span className="rounded-lg border border-[var(--lp-rule-strong)] px-4 py-2 text-[12px] text-[var(--lp-body)] lg:px-[15px] lg:py-[7px] lg:text-[11.5px]">
            거절
          </span>
        </div>
      </>
    ),
  },
];

export function Flow() {
  return (
    <section className={`${SECTION_X} ${SECTION_TOP}`}>
      <div className={CONTAINER}>
        <Eyebrow>사용 흐름</Eyebrow>
        <SectionTitle>로그인부터 첫 요약까지 여섯 걸음</SectionTitle>
        <SectionLead>
          각 걸음에서 실제로 누르는 것을 그대로 옮겼습니다. 아래 문구는 앱 안에
          있는 말 그대로입니다.
        </SectionLead>

        <ol className="m-0 mt-8 list-none p-0 lg:mt-11">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
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
      </div>
    </section>
  );
}
