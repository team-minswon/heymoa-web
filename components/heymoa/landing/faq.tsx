"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

import {
  CONTAINER,
  Eyebrow,
  SECTION_TOP,
  SECTION_X,
} from "@/components/heymoa/landing/shell";

/**
 * 자주 묻는 질문. 실제로 열리고 닫힌다 — 시안은 첫 항목만 펼친 그림이었지만 그림을 그대로
 * 옮기면 나머지 넷은 눌러도 아무 일도 안 나는 가짜가 된다.
 *
 * **여는 것은 `<button>`이다.** 접기는 이동이 아니라 동작이라 링크로 두면 안 되고,
 * 제목 위계를 지키려고 `<h3>` 안에 버튼을 넣는다(제목이 버튼을 감싸는 쪽이 표준 형태다).
 * 한 번에 하나만 열리게 두지 않은 것은, 답을 나란히 놓고 비교하는 사람을 막을 이유가 없어서다.
 */

const QA: Array<{ q: string; a: string }> = [
  {
    q: "회의 기록만 남기는 도구와 무엇이 다른가요?",
    a: "전사와 요약에서 멈추지 않습니다. 결정과 액션 아이템에는 그 말이 나온 전사 줄이 근거로 붙어 눌러서 되짚을 수 있고, 회의는 프로젝트 단위로 묶여 쌓입니다. 지난 회의를 되짚는 것은 에이전트에게 물어보는 방식입니다.",
  },
  {
    q: "회의 중에 흐름을 끊지 않고 물어볼 수 있나요?",
    a: "네. 회의가 도는 동안에도 오른쪽 레일에서 에이전트에게 바로 물어볼 수 있고, 지금까지의 전사와 지난 회의를 함께 보고 답합니다.",
  },
  {
    q: "정리된 업무가 저절로 외부 도구로 나가나요?",
    a: "아니요. 에이전트가 도구에 쓰기 전에 승인 카드가 뜨고, 승인한 호출만 Linear 와 GitHub 로 나갑니다. 나간 결과의 링크는 대화 기록에 남습니다.",
  },
  {
    q: "지난 회의에서 정한 것을 다시 찾아볼 수 있나요?",
    a: "네. 에이전트에게 물어보면 지난 회의록에서 찾아 답하고, 답변 아래에 실제로 참고한 회의록이 붙어 그 자리로 갈 수 있습니다. 프로젝트나 회의록을 지목해 그 안에서만 찾게 할 수도 있습니다.",
  },
  {
    q: "설치할 것이 있나요?",
    a: "설치할 것은 없습니다. Google 계정으로 로그인하면 워크스페이스가 하나 만들어지고, 그 안에 회의를 담을 프로젝트를 하나 만든 뒤 회의를 시작하면 됩니다. 마이크 권한만 필요합니다.",
  },
];

export function Faq() {
  // 첫 항목만 열어 둔다 — 무엇이 들어 있는 자리인지 하나는 보여야 나머지를 누른다.
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));
  const baseId = useId();
  // 찾기가 펼치는 길. `Answer` 의 효과가 이것을 의존하므로 고정해야 한다.
  const reveal = useCallback(
    (i: number) => setOpen((current) => new Set(current).add(i)),
    []
  );

  return (
    <section id="faq" className={`${SECTION_X} ${SECTION_TOP} scroll-mt-24`}>
      <div
        className={`${CONTAINER} flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-20`}
      >
        <div className="flex shrink-0 flex-col gap-3 lg:w-[340px] lg:gap-3.5">
          <Eyebrow>자주 묻는 질문</Eyebrow>
          <h2 className="m-0 text-balance break-keep text-[25px] font-extrabold leading-[1.3] tracking-[-0.8px] text-[var(--lp-ink)] lg:text-[40px] lg:leading-[1.25] lg:tracking-[-1.4px]">
            먼저 확인하실 것
          </h2>
        </div>

        <ul className="m-0 flex min-w-0 flex-1 list-none flex-col p-0">
          {QA.map((item, i) => {
            const isOpen = open.has(i);
            const panelId = `${baseId}-faq-${i}`;
            return (
              <li
                key={item.q}
                className={`flex flex-col border-t border-[var(--lp-rule)] py-5 lg:py-6 ${i === QA.length - 1 ? "border-b" : ""}`}
              >
                <h3 className="m-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() =>
                      setOpen((current) => {
                        const next = new Set(current);
                        if (!next.delete(i)) next.add(i);
                        return next;
                      })
                    }
                    className="flex min-h-[26px] w-full cursor-pointer items-start gap-4 border-0 bg-transparent p-0 text-left lg:gap-5"
                  >
                    <span className="min-w-0 flex-1 break-keep text-[17px] font-bold leading-[1.5] tracking-[-0.3px] text-[var(--lp-ink)] lg:text-[18px] lg:tracking-[-0.4px]">
                      {item.q}
                    </span>
                    {isOpen ? (
                      <Minus
                        aria-hidden
                        className="size-[18px] shrink-0 text-[#8a7a6d]"
                      />
                    ) : (
                      <Plus
                        aria-hidden
                        className="size-[18px] shrink-0 text-[#8a7a6d]"
                      />
                    )}
                  </button>
                </h3>
                <Answer id={panelId} index={i} open={isOpen} onFound={reveal}>
                  {item.a}
                </Answer>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * 접힌 답. **DOM에 남기는 것만으로는 페이지 내 찾기(Ctrl+F)가 못 찾는다** — 그냥 `hidden`은
 * `display:none`이라 브라우저의 찾기 대상에서 통째로 빠진다. 찾히게 하려면 값이
 * `until-found`여야 하는데, react가 `hidden`을 **불리언 속성으로 못박아** 뒀다
 * (`react-dom` 19: 참이면 `setAttribute(key, "")`). JSX로는 문자열을 못 넣는다.
 *
 * 그래서 붙은 뒤에 직접 올려 쓴다. 서버 HTML과 첫 렌더는 평범한 `hidden`이라 하이드레이션
 * 불일치가 없고, 붙고 나면 `until-found`로 바뀌어 찾기가 스스로 펼친다. react가 렌더마다
 * `hidden=""`로 되돌리므로 매 렌더 뒤에 다시 올린다.
 *
 * `beforematch`는 react의 합성 이벤트에 없어서 같은 효과에서 직접 듣는다. `onFound`는
 * 부모가 `useCallback`으로 고정해 넘긴다 — 인라인이면 이 효과가 렌더마다 다시 걸린다.
 */
function Answer({
  id,
  index,
  open,
  onFound,
  children,
}: {
  id: string;
  index: number;
  open: boolean;
  onFound: (index: number) => void;
  children: React.ReactNode;
}) {
  const el = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node || open) return;
    node.setAttribute("hidden", "until-found");
    const found = () => onFound(index);
    node.addEventListener("beforematch", found);
    return () => node.removeEventListener("beforematch", found);
  }, [open, index, onFound]);

  return (
    <p
      ref={el}
      id={id}
      hidden={!open}
      data-faq-answer={open ? "" : undefined}
      className="m-0 mt-3 max-w-[640px] break-keep text-[14.5px] leading-[1.8] text-[var(--lp-body)] lg:text-[15px]"
    >
      {children}
    </p>
  );
}
