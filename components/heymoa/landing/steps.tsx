import { FileText, FolderCheck, Mic } from "lucide-react";

import { CONTAINER, Eyebrow, SECTION_X } from "@/components/heymoa/landing/shell";
import { MiniConfirmBar, MiniReview, MiniTranscript } from "@/components/heymoa/landing/mocks";

/**
 * 「작동 방식」 흰 밴드. 듣는 동안 · 끝나고 나면 · 그 다음을 카드 셋으로 세운다.
 *
 * 셋은 앱이 실제로 밟는 순서다 — 회의 중에는 스크립트가 쌓이고, 끝나면 분석이 몇 분 돌아
 * 요약 탭에 검토 문서가 서고, 사람이 「검토 완료」를 눌러야 결정과 할 일이 프로젝트에 올라간다.
 * 「끝나는 순간」이라 쓰지 않는 것은 분석이 바로 끝나지 않아서다(화자 나누기 → 분석, 몇 분).
 * Linear · GitHub 로 보내는 것은 에이전트에게 따로 시키는 일이라 이 순서에 넣지 않는다.
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
    title: "끝나고 나면",
    line: "요약 · 주제 · 결정 · 할 일이 검토를 기다립니다",
    mock: <MiniReview />,
  },
  {
    n: "03",
    icon: FolderCheck,
    title: "그 다음",
    line: "검토한 결정과 할 일만 프로젝트에 올라갑니다",
    mock: <MiniConfirmBar />,
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
            듣고, 묶어 두고, 검토해서 남깁니다
          </h2>
        </div>

        {/* 좁은 화면도 열을 `minmax(0,1fr)`로 못박는다 — 기본 열은 내용 폭을 따라가서, 목업의
            한 줄로 자르는 항목(`truncate`)이 제 전체 길이로 카드를 밀어 320에서 화면을 넘겼다. */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3 lg:gap-5">
          {CARDS.map(({ n, icon: Icon, title, line, mock }, i) => (
            <div
              key={n}
              data-lift
              data-stagger
              style={{ "--i": i } as React.CSSProperties}
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
