import { CONTAINER, SECTION_X } from "@/components/heymoa/landing/shell";

/**
 * 「원칙」 다크 밴드. 왼쪽에 원칙, 오른쪽에 인용 카드.
 *
 * **위 여백을 이 섹션이 갖는다.** 앞 섹션(기능 소개)은 아래 여백이 0이라 밴드가 카드 바닥에
 * 그대로 붙는다 — 크림 틈이 한 픽셀도 없어서 카드가 잘린 것처럼 보였다. 아트보드 원본에도
 * 있던 문제라 여기서 막는다.
 *
 * 「예시 문안」은 고객 후기가 아니다. 실제 후기를 받아 온 적이 없어서 지어내지 않고, 이 제품이
 * 답하려는 말을 예시로 적어 둔 자리다 — 라벨이 그 사실을 밝힌다.
 */
export function Principle() {
  return (
    <section
      className={`${SECTION_X} mt-16 bg-[var(--lp-dark)] py-14 lg:mt-[104px] lg:py-23`}
    >
      <div className={`${CONTAINER} flex flex-col gap-8 lg:flex-row lg:gap-14`}>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[13px] font-semibold tracking-[0.4px] text-[var(--lp-green-soft)]">
            원칙
          </p>
          <h2 className="m-0 mt-3 max-w-[640px] text-balance break-keep text-[25px] font-extrabold leading-[1.32] tracking-[-0.8px] text-[var(--lp-on-dark)] lg:mt-3.5 lg:text-[40px] lg:leading-[1.25] lg:tracking-[-1.4px]">
            근거 없이 남기지 않고, 승인 없이 내보내지 않습니다.
          </h2>
          <p className="m-0 mt-4 max-w-[620px] break-keep text-[14.5px] leading-[1.78] text-[var(--lp-on-dark-soft)] lg:text-[16px] lg:leading-[1.75]">
            정리된 항목에는 그 말이 나온 자리가 근거로 붙습니다. 지난 회의를 다시
            꺼낼 때 그 회의의 전사에서 근거를 찾아 답합니다. 외부 도구로 나가는
            일은 사람이 승인한 것만입니다.
          </p>
          <ul className="m-0 mt-5 flex list-none flex-wrap gap-1.5 p-0 lg:gap-2">
            {["근거 연결", "승인 게이트", "프로젝트별 보관"].map((t) => (
              <li
                key={t}
                className="rounded-full border border-[var(--lp-dark-rule)] px-3 py-1.5 text-[12px] font-medium text-[var(--lp-on-dark)] lg:text-[12.5px]"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="box-border w-full shrink-0 rounded-2xl border border-[var(--lp-dark-rule)] bg-[var(--lp-dark-soft)] p-5 lg:w-[420px] lg:p-7">
          <p className="m-0 font-mono text-[11.5px] font-semibold text-[var(--lp-green-soft)]">
            예시 문안
          </p>
          <p className="m-0 mt-3 break-keep font-serif text-[16px] font-medium leading-[1.75] text-[var(--lp-on-dark)] lg:text-[18px]">
            “결정은 회의록에 있는데, 왜 그렇게 정했는지는 아무 데도 없습니다.”
          </p>
          <p className="m-0 mt-3.5 break-keep text-[12.5px] leading-[1.7] text-[var(--lp-on-dark-soft)] lg:text-[13px]">
            그 「왜」를 전사 줄로 붙여 두는 것이 이 제품이 하는 일입니다.
          </p>
        </div>
      </div>
    </section>
  );
}
