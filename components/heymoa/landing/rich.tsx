import type { ReactNode } from "react";

/**
 * 언어 파일 문장 속 태그(`t.rich(key, RICH)`). `<nw>` 는 줄이 갈리지 않게 묶을 덩어리, `<b>` 는 굵게,
 * `<br></br>` 는 줄바꿈이다. 모양이 다른 강조는 부르는 쪽이 같은 이름으로 덮어 넘긴다.
 */
export const RICH = {
  nw: (chunks: ReactNode) => (
    <span className="whitespace-nowrap">{chunks}</span>
  ),
  b: (chunks: ReactNode) => <b>{chunks}</b>,
  br: () => <br />,
};
