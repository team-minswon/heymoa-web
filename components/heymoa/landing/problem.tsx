import { CircleCheck, Compass } from "lucide-react";

import {
  CONTAINER,
  Eyebrow,
  SECTION_TOP,
  SECTION_X,
  SectionLead,
  SectionTitle,
} from "@/components/heymoa/landing/shell";

/**
 * 「왜 만드나」. 문제 셋을 세우고, 각각 지금 무엇이 되는지 옆에 붙인다.
 *
 * **셋째 줄만 「방향」이라고 적는다.** 안건 대조는 아직 없는 동작이라서다 — 코드에 없는 것을
 * 있는 것처럼 적지 않으려고 라벨과 아이콘을 갈랐다. heymoa-web · heymoa-server · heymoa-ai
 * 어디에도 안건 이탈을 보는 자리가 없다.
 *
 * **가르는 것은 말과 아이콘까지다.** 한때 점선 테두리와 흐린 칩으로도 갈라 그렸는데 시안에
 * 없는 연출이었고, 줄 하나만 미완성처럼 보였다. 상자는 셋이 똑같다.
 */

type Row = {
  mark: string;
  title: string;
  body: string;
  boxLabel: string;
  boxBody: string;
  chips: string[];
  /** 아직 없는 동작 — 나침반 아이콘과 「방향」 라벨로만 갈린다. */
  planned?: boolean;
};

const ROWS: Row[] = [
  {
    mark: "(01)",
    title: "결정은 남고 이유는 사라진다",
    body: "회의록에 남는 건 결론 한 줄입니다. 그 한 줄을 말한 사람이 팀을 떠나면 왜 그렇게 정했는지 물어볼 곳이 없어지고, 결국 같은 논의를 한 번 더 하게 됩니다.",
    boxLabel: "지금 되는 것",
    boxBody:
      "전사와 요약을 남기고, 회의를 프로젝트 아래 모아 둡니다. 결정에는 그 말이 나온 자리를 근거로 붙입니다.",
    chips: ["전사", "요약", "프로젝트별 묶기"],
  },
  {
    mark: "(02)",
    title: "모르는 채로 업무를 받는다",
    body: "모르는 약어나 지난 결정이 나와도 흐름을 끊기가 부담스럽습니다. 그냥 넘어가고, 이해하지 못한 채로 할 일을 배정받습니다.",
    boxLabel: "지금 되는 것",
    boxBody:
      "회의가 도는 동안 레일에서 에이전트에게 바로 물어볼 수 있습니다. 에이전트에게 이슈 생성을 시키면, 승인한 것만 Linear · GitHub 로 나갑니다.",
    chips: ["회의 중 질의", "Linear 연동", "GitHub 연동"],
  },
  {
    mark: "(03)",
    title: "안건에서 언제 벗어났는지 모른다",
    body: "이야기가 옆길로 새도 그 순간에는 알아차리기 어렵습니다. 끝나고 나서야 정작 정해야 할 것을 못 정했다는 걸 압니다.",
    boxLabel: "방향",
    boxBody:
      "다루는 중인 주제를 안건과 견주어 보여 주려 합니다. 이 동작은 계약 추가가 먼저 필요합니다.",
    chips: ["안건 대조", "이탈 신호", "계약 추가 필요"],
    planned: true,
  },
];

export function Problem() {
  return (
    <section id="why" className={`${SECTION_X} ${SECTION_TOP}`}>
      <div className={CONTAINER}>
        <Eyebrow>왜 만드나</Eyebrow>
        <SectionTitle className="max-w-[900px]">
          결정은 남는데, 이유는 남지 않는다.
        </SectionTitle>
        <SectionLead>
          사람이 자주 바뀌고 회의 하나가 다음 회의의 전제가 되는 팀에서, 반복해서
          본 세 장면입니다.
        </SectionLead>

        <ul className="m-0 mt-7 flex list-none flex-col p-0 lg:mt-14">
          {ROWS.map((row, i) => (
            <li
              key={row.mark}
              className={`flex flex-col gap-2.5 border-t border-[var(--lp-rule)] py-[22px] lg:flex-row lg:gap-12 lg:py-9 ${
                i === ROWS.length - 1 ? "border-b border-[var(--lp-rule)]" : ""
              }`}
            >
              <div className="flex shrink-0 flex-col gap-2.5 lg:w-[340px] lg:gap-3">
                <span className="font-mono text-[12px] font-semibold tabular-nums text-[var(--lp-muted)]">
                  {row.mark}
                </span>
                <h3 className="m-0 break-keep text-[18px] font-bold leading-[1.35] tracking-[-0.5px] text-[var(--lp-ink)] lg:text-[23px] lg:leading-[1.4] lg:tracking-[-0.6px]">
                  {row.title}
                </h3>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2.5 lg:gap-5">
                <p className="m-0 break-keep text-[14px] leading-[1.75] text-[var(--lp-body)] lg:text-[15.5px]">
                  {row.body}
                </p>

                <div className="flex flex-col gap-2.5 rounded-xl bg-[var(--lp-cream-soft)] p-3.5 lg:rounded-[14px] lg:px-5 lg:py-[18px]">
                  <div className="flex items-center gap-2">
                    {row.planned ? (
                      <Compass aria-hidden className="size-3.5 shrink-0 text-[var(--lp-accent)]" />
                    ) : (
                      <CircleCheck
                        aria-hidden
                        className="size-3.5 shrink-0 text-[var(--lp-accent)]"
                      />
                    )}
                    <span className="text-[11.5px] font-bold text-[var(--lp-accent)] lg:text-[12.5px]">
                      {row.boxLabel}
                    </span>
                  </div>
                  <p className="m-0 break-keep text-[13px] leading-[1.7] text-[var(--lp-body)] lg:text-[14.5px]">
                    {row.boxBody}
                  </p>
                  <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
                    {row.chips.map((c) => (
                      <li
                        key={c}
                        className="rounded-full border border-[var(--lp-rule)] bg-[var(--lp-card)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--lp-body)]"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
