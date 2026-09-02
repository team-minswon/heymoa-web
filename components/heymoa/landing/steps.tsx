import { FileText, Mic, Share2 } from "lucide-react";

import { CONTAINER, Eyebrow, SECTION_X } from "@/components/heymoa/landing/shell";
import { ApprovalCard, MiniTranscript, SummarySplit } from "@/components/heymoa/landing/mocks";

/**
 * 「작동 방식」 흰 밴드. 회의 중 · 끝나는 순간 · 그 다음을 카드 셋으로 세운다.
 *
 * **여기만 위아래 여백을 다 갖는다.** 흰 밴드라 배경이 바뀌는 자리이고, 위아래 hairline이
 * 크림 면과 이 면을 가른다 — 크림 위 섹션들의 「위 여백만」 규칙이 여기서는 안 맞는다.
 *
 * 번호(01/02/03)를 붙인 것은 이 셋이 실제로 순서라서다. 순서가 아닌 목록에는 안 붙인다.
 */

const CARDS = [
  {
    n: "01",
    icon: Mic,
    title: "듣는 동안",
    line: "발화가 시각과 함께 한 줄씩 쌓입니다",
    mock: <MiniTranscript />,
  },
  {
    n: "02",
    icon: FileText,
    title: "끝나는 순간",
    line: "개요 · 액션 아이템 · 결정으로 갈립니다",
    mock: <SummarySplit />,
  },
  {
    n: "03",
    icon: Share2,
    title: "그 다음",
    line: "승인한 것만 Linear 와 GitHub 로 나갑니다",
    mock: <ApprovalCard />,
  },
];

export function Steps() {
  return (
    <section
      id="how-it-works"
      className={`${SECTION_X} scroll-mt-24 border-y border-[var(--lp-rule)] bg-[var(--lp-card)] pt-14 pb-15 lg:pt-23 lg:pb-24`}
    >
      <div className={`${CONTAINER} flex flex-col gap-6.5 lg:gap-10`}>
        {/* 이 섹션만 머리글이 가운데다 — 흰 밴드로 면이 바뀌는 자리라 시안이 축을 옮겼다. */}
        <div className="flex flex-col gap-3 lg:items-center">
          <Eyebrow>작동 방식</Eyebrow>
          <h2 className="m-0 w-full text-balance break-keep text-[26px] font-extrabold leading-[1.28] tracking-[-0.9px] text-[var(--lp-ink)] lg:text-center lg:text-[42px] lg:leading-[1.25] lg:tracking-[-1.2px]">
            듣고, 갈라 놓고, 승인받아 내보냅니다
          </h2>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-3 lg:gap-5">
          {CARDS.map(({ n, icon: Icon, title, line, mock }) => (
            <div
              key={n}
              className="box-border flex flex-col gap-[11px] rounded-2xl border border-[var(--lp-rule)] bg-[var(--lp-canvas)] p-5 lg:gap-3 lg:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[12px] font-semibold tabular-nums text-[var(--lp-muted)] lg:text-[13px]">
                  {n}
                </span>
                <span className="flex size-8 items-center justify-center rounded-[10px] bg-[var(--lp-cream)] lg:size-[34px]">
                  <Icon aria-hidden className="size-4 text-[var(--lp-accent)] lg:size-[17px]" />
                </span>
              </div>
              <h3 className="m-0 break-keep text-[18px] font-bold tracking-[-0.4px] text-[var(--lp-ink)] lg:text-[20px]">
                {title}
              </h3>
              <p className="m-0 break-keep text-[13.5px] leading-[1.65] text-[var(--lp-body)] lg:text-[14.5px]">
                {line}
              </p>
              <div className="box-border overflow-hidden rounded-[10px] border border-[var(--lp-rule)] bg-[var(--lp-card)] p-[11px] lg:h-[184px] lg:p-3">
                {mock}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
