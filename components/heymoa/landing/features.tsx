import type { ReactNode } from "react";
import { Check } from "lucide-react";

import {
  ApprovalThread,
  InviteList,
  RailFlow,
  SummaryList,
  TranscriptPane,
  ChatAsk,
} from "@/components/heymoa/landing/feature-mocks";
import {
  CONTAINER,
  Eyebrow,
  SECTION_TOP,
  SECTION_X,
} from "@/components/heymoa/landing/shell";

/**
 * 「기능 소개」. 카드 여섯을 2열 3행으로 세운다.
 *
 * **한 줄 설명과 불릿이 하는 일이 다르다.** 한 줄은 「무엇이 편해지나」, 불릿 셋은 「실제로
 * 어떻게 되나」다. 예전에는 둘이 같은 말을 두 번 했다 — 「회의가 끝나면 개요·액션 아이템·
 * 결정으로 갈립니다」가 설명에도 불릿에도 있었다.
 *
 * 순서는 회의 중에 일어나는 셋(전사 · 실시간 정리 · 질의)을 앞에, 회의 뒤(자동 정리 ·
 * 내보내기)를 가운데, 팀 단위인 초대를 끝에 둔다.
 */

type Card = { title: string; lead: string; bullets: string[]; mock: ReactNode };

const CARDS: Card[] = [
  {
    title: "실시간 전사",
    lead: "받아 적을 사람을 따로 두지 않아도 됩니다.",
    bullets: [
      "발화마다 시각이 붙어 한 줄씩 들어옵니다",
      "화자 이름은 회의가 끝난 뒤에 붙습니다",
      "통째로 복사하면 시각과 화자가 붙은 줄로 옮겨집니다",
    ],
    mock: <TranscriptPane />,
  },
  {
    title: "실시간 정리",
    lead: "회의가 끝나기를 기다리지 않아도 됩니다.",
    bullets: [
      "결정 · 할 일 · 질문으로 나뉘어 회의 중에 쌓입니다",
      "전체 · 결론 · 논의 중 · 참고로 걸러 봅니다",
      "뒤집힌 항목은 지우지 않고 「철회됨」으로 남습니다",
    ],
    mock: <RailFlow />,
  },
  {
    title: "회의 중 질의",
    lead: "모르는 게 나와도 회의를 세우지 않아도 됩니다.",
    bullets: [
      "오른쪽 레일에서 회의가 도는 중에 묻습니다",
      "지금까지의 전사와 지난 회의를 함께 보고 답합니다",
      "답변 아래에 참고한 회의록이 붙습니다",
    ],
    mock: <ChatAsk />,
  },
  {
    title: "자동 정리",
    lead: "끝나고 나서 다시 읽고 정리할 일이 없습니다.",
    bullets: [
      "회의를 종료하면 개요 · 액션 아이템 · 결정으로 갈립니다",
      "항목마다 그 말이 나온 전사 줄이 근거로 붙습니다",
      "회의 중에는 남길 만한 변화가 사건 흐름에 쌓입니다",
    ],
    mock: <SummaryList />,
  },
  {
    title: "도구로 내보내기",
    lead: "이슈로 옮겨 적는 일을 사람이 하지 않아도 됩니다.",
    bullets: [
      "대화로 시키면 쓰기 전에 승인 카드가 뜹니다",
      "승인한 호출만 Linear 와 GitHub 로 나갑니다",
      "나간 결과의 링크는 대화 기록에 남습니다",
    ],
    mock: <ApprovalThread />,
  },
  {
    title: "멤버 초대",
    lead: "합류한 사람이 지난 회의부터 읽고 시작합니다.",
    bullets: [
      "관리자가 이메일로 초대하면 링크가 갑니다",
      "초대 링크는 하루 동안만 유효합니다",
      "역할은 관리자와 멤버로 나뉩니다",
    ],
    mock: <InviteList />,
  },
];

export function Features() {
  return (
    <section id="features" className={`${SECTION_X} ${SECTION_TOP} scroll-mt-24`}>
      <div className={`${CONTAINER} flex flex-col gap-6 lg:gap-10`}>
        <div className="flex flex-col gap-3.5">
          <Eyebrow>기능 소개</Eyebrow>
          <h2 className="m-0 text-balance break-keep text-[26px] font-extrabold leading-[1.28] tracking-[-0.9px] text-[var(--lp-ink)] lg:text-[46px] lg:leading-[1.25] lg:tracking-[-1.6px]">
            기록하고, 묻고, 정리하고, 내보내고, 함께 씁니다
          </h2>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-6">
          {CARDS.map((c) => (
            <div
              key={c.title}
              className="box-border flex flex-col rounded-[18px] border border-[var(--lp-rule)] bg-[var(--lp-card)] p-3 lg:p-3.5"
            >
              {/* 크림 패널이 앱 화면을 받친다 — 창을 바로 흰 카드 위에 두면 경계가 사라진다. */}
              <div className="box-border overflow-hidden rounded-xl bg-[var(--lp-cream)] p-3.5 lg:p-4">
                <div className="box-border overflow-hidden rounded-[10px] lg:h-[244px] border border-[var(--lp-rule)] bg-[var(--lp-card)] shadow-[0_2px_8px_#33231a12]">
                  {c.mock}
                </div>
              </div>
              <div className="flex flex-col gap-2.5 px-1.5 pt-5 pb-3 lg:px-2.5 lg:pt-[22px]">
                <h3 className="m-0 break-keep text-[20px] font-bold tracking-[-0.5px] text-[var(--lp-ink)] lg:text-[22px]">
                  {c.title}
                </h3>
                <p className="m-0 text-[14px] leading-[1.7] text-[var(--lp-body)] lg:text-[14.5px]">
                  {c.lead}
                </p>
                <ul className="m-0 mt-1.5 flex list-none flex-col gap-2 p-0">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check
                        aria-hidden
                        className="mt-[3px] size-3.5 shrink-0 text-[var(--lp-green)]"
                        strokeWidth={2.5}
                      />
                      <span className="break-keep text-[13px] leading-[1.5] text-[var(--lp-body)] lg:text-[13.5px]">
                        {b}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
