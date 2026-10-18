/**
 * 핵심 문구 형광펜. 마크다운의 `==문구==` 가 이것으로 그려진다(`components/help/md/render.tsx`).
 * 되돌릴 수 없는 일 · 꼭 지킬 순서 · 한도 숫자처럼 **정말 놓치면 안 되는 말**에만 쓴다(페이지당 2~3곳, 한 문단에 하나까지).
 * 단계 문장 전체나 제목은 칠하지 않는다. 색과 칠해지는 움직임은 `app/globals.css` 의 `.help-key` 한 곳이다.
 */
export const Key = ({ children }: { children: React.ReactNode }) => (
  <mark data-key="" className="help-key">
    {children}
  </mark>
);
