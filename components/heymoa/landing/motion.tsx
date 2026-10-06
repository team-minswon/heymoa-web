/*
 * tl;dv 판의 움직임 전부. 창 안 = `--el-*` · `APP` · `ROLE_*`, 창 밖 · 창 위 주석 = `--tv-*` 이고,
 * 여기 색이 든 키프레임(섬광 · 고리 · 누름)은 창 위에 얹는 주석이거나 앱의 붉은 상태색이다.
 *
 * **모든 등장 · 그리기 · 반복은 `prefers-reduced-motion: no-preference` 안에만 있다.** 규칙 밖의
 * 기본값(정지 상태)이 곧 「다 보이고 다 그려진」 끝 상태라, 모션을 줄이면 아무것도 숨지 않는다.
 *
 * 쓰는 법(클래스 → 무엇):
 * - 마운트 때: `tv-rise`(올라옴, 순번 `--i`) · `tv-pop`(튀어나옴, `--d`) · `tv-glide`(커서) ·
 *   `tv-ripple`(누름 고리, `--d`) · `tv-flash`(방금 붙은 줄 섬광) · `tv-bump`(숫자 한 번 커짐) ·
 *   `tv-press`(붉은 버튼 눌림 1.4s) · `tv-ring`(노란 고리, 반복 `--n`) · `tv-mark`(형광펜, `--d`) ·
 *   `tv-draw`(선 그리기, `--d`)
 * - 반복: `tv-level`(파형) · `tv-level-brief`(파형 다섯 번, 4.5초 — WCAG 2.2.2 의 5초 아래) · `tv-blink`(점) · `tv-blink-3` · `tv-caret`.
 * - 일시정지(WCAG 2.2.2): `[data-paused]` 아래에서는 **클래스를 가리지 않고 모든 애니메이션이 선다** —
 *   가상 요소(`before:[animation:…]`, 예: `hero-note.tsx` 의 새 줄 섬광)와 앱 전역 클래스(`chat-*` ·
 *   `animate-*`)까지. 목록으로 고르면 새로 단 움직임이 빠진다. `!important` 는 뒤에 오는 `.tv-*`
 *   축약형(`animation:`)이 재생 상태를 running 으로 되돌리지 못하게 하려는 것이다. 예외는 한 번 퍼지고
 *   마는 `tv-ring` 하나 — 멈춘 채 굳으면 앱 칩 · 버튼에 테두리가 한 겹 더 붙은 것처럼 보여서, 정지 중에는
 *   끝 상태(그림자 없음)로 보낸다. 다시 재생하면 남은 만큼 이어 퍼진다. **한 번 들어오고 마는 등장
 *   (`chat-rise` · `tv-rise` · `tv-pop` 등)은 정지 중에 아예 끈다** — 멈춘 채 방문자가 탭을 바꾸거나 근거를
 *   펼치면 새로 붙은 본문이 첫 프레임(`opacity: 0`)에 얼어 재생할 때까지 안 보였다. 끄면 기본값이 곧 끝
 *   상태라 바로 보인다. 누름 고리(`tv-ripple`) · 붉은 누름(`tv-press`)은 기본값이 끝 상태가 아니라 뺐다. 전이(transition)는 0.45s 이하라
 *   두고, 대본이 얼면 새 전이도 시작되지 않는다.
 * - 전이: `tv-tabline`(탭 밑줄 scale) · `tv-end`(접히는 버튼) · `tv-dock` · `tv-dim` ·
 *   `tv-swing`(기울어진 카드, `--tilt`; 넓은 화면에서 올리면 바로 선다, 좁은 화면은 늘 0°).
 * - 스크롤 등장(`components/heymoa/landing/reveal.tsx` 의 `Reveal` 이 `data-reveal` · `data-shown`
 *   을 단다): 안쪽에 `tv-r`(올라옴, `--i`) · `tv-rpop`(튀어나옴, `--d`) · `tv-rmark`(형광펜, `--d`) ·
 *   `tv-rdraw`(선, `--d`) · `tv-rslide`(비스듬히 들어옴, `--d`).
 * - FAQ: `<details className="tv-faq">` 가 부드럽게 열린다.
 * - 흐르는 띠(`works-with.tsx`): `tv-marquee`(트랙, 1/3 만큼 미끄러짐, `--dur` · `data-dir=right` 면 반대로) ·
 *   `tv-fade`(줄 양끝 흐림, 올리면 그 줄이 멈춤) · `tv-band`(포커스가 들어오면 두 줄 다 멈춤). 모션을 줄이면
 *   흐르지 않고 첫 벌(`tv-marquee-set`)만 접혀 서고 복사본(`tv-marquee-dup`)은 숨는다.
 * `.chat-shimmer` · `.chat-rise` 는 전역(`globals.css`)이라 창 안에서 그대로 쓴다.
 *
 * 움직임이 아닌 규칙이 하나 섞여 있다 — `.tv-row`(`app.tsx` `ROW_LINE`, 검토 줄 · 스크립트 줄): **뒤에 줄이
 * 없으면 아래 선을 지운다.** 잘라 보인 창 · 카드에서 마지막 줄 선이 프레임 바닥 바로 위에 남아 바닥이 두 겹으로
 * 읽혔다. 「뒤에 줄」은 줄 자신의 뒤 형제(`~.tv-row`)이거나, 줄을 한 겹 감싼 칸의 뒤 형제(`~*>.tv-row`)다 —
 * 구간들이 줄을 한 칸씩 감싸서(히어로 `data-row`, 근거 구간 번호표 칸) `:last-child` 로는 가를 수 없다.
 * Tailwind 임의 변형 대신 여기 두는 까닭은 `:has()` 안의 쉼표 · `~` · `>` 를 클래스 이름으로 옮기지 않으려는 것.
 * 층(@layer) 밖 규칙이라 구간의 `border-b` 유틸리티로는 되살리지 못한다(되살릴 자리가 지금 없다).
 */
const CSS = `
.tv-row:not(:has(~.tv-row,~*>.tv-row)):not(:has(~.tv-row,~*>.tv-row)>*){border-bottom-width:0}
.tv-swing{rotate:var(--tilt,0deg)}
html{scroll-padding-top:5rem}
[data-paused],[data-paused] *,[data-paused] *::before,[data-paused] *::after{animation-play-state:paused!important}
[data-paused] .tv-ring{box-shadow:none!important}
[data-paused] :is(.chat-rise,.tv-rise,.tv-pop,.tv-glide,.tv-flash,.tv-bump,.tv-mark,.tv-draw){animation:none}
@media (prefers-reduced-motion: no-preference){
.tv-root{interpolate-size:allow-keywords}
.tv-rise{animation:tv-rise .5s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--i,0)*70ms)}
@keyframes tv-rise{from{opacity:0;translate:0 12px}}
.tv-pop{animation:tv-pop .34s cubic-bezier(.34,1.56,.64,1) both;animation-delay:var(--d,0ms)}
@keyframes tv-pop{from{opacity:0;scale:.8;translate:0 6px}}
.tv-glide{animation:tv-glide .45s cubic-bezier(.16,1,.3,1) both}
@keyframes tv-glide{from{opacity:0;translate:18px 22px}}
.tv-ripple{animation:tv-ripple .6s ease-out both;animation-delay:var(--d,0ms)}
@keyframes tv-ripple{from{opacity:.95;scale:.4}to{opacity:0;scale:1.8}}
.tv-flash{animation:tv-flash 1.6s ease-out both}
@keyframes tv-flash{from{background-color:rgba(255,210,63,.45)}to{background-color:transparent}}
.tv-bump{display:inline-block;animation:tv-bump .32s ease-out}
@keyframes tv-bump{50%{scale:1.3}}
.tv-press{animation:tv-press 1.4s cubic-bezier(.22,.68,.32,1) both}
@keyframes tv-press{0%{scale:1;background-color:transparent;box-shadow:0 0 0 0 #dc262600}18%{scale:1;background-color:#fee2e2;box-shadow:0 0 0 0 #dc26263d}30%{scale:.93;background-color:#fee2e2}56%{scale:.93;background-color:#fee2e2;box-shadow:0 0 0 8px #dc262600}74%{scale:1.015}100%{scale:1;background-color:#fee2e2;box-shadow:0 0 0 0 #dc262600}}
.tv-ring{animation:tv-ring .8s ease-out both;animation-iteration-count:var(--n,1)}
@keyframes tv-ring{from{box-shadow:0 0 0 0 rgba(255,210,63,.95)}to{box-shadow:0 0 0 10px rgba(255,210,63,0)}}
.tv-level{transform-origin:center;animation:tv-level .9s ease-in-out infinite alternate;animation-delay:calc(var(--i,0)*-.23s)}
.tv-level-brief{transform-origin:center;animation:tv-level .9s ease-in-out 5 alternate;animation-delay:calc(var(--i,0)*-.23s)}
@keyframes tv-level{from{scale:1 .25}to{scale:1 1}}
.tv-blink{animation:tv-blink 1.2s ease-in-out infinite}
.tv-blink-3{animation:tv-blink 1.2s ease-in-out 3}
@keyframes tv-blink{50%{opacity:.25}}
.tv-caret{animation:tv-caret 1s steps(2,start) infinite}
@keyframes tv-caret{to{opacity:0}}
.tv-mark{animation:tv-mark .6s ease-out both;animation-delay:var(--d,0ms)}
@keyframes tv-mark{from{background-size:0 .42em}}
.tv-draw{stroke-dasharray:1;animation:tv-draw .7s ease-out both;animation-delay:var(--d,0ms)}
@keyframes tv-draw{from{stroke-dashoffset:1}}
.tv-tabline{transition:scale .22s ease-out}
.tv-end{transition:max-inline-size .3s cubic-bezier(.16,1,.3,1),padding .3s cubic-bezier(.16,1,.3,1),margin .3s cubic-bezier(.16,1,.3,1),border-color .3s ease-out,opacity .22s ease-out}
.tv-dock{transition:opacity .22s ease-out,translate .3s cubic-bezier(.16,1,.3,1)}
.tv-dim{transition:opacity .3s ease-out}
[data-reveal]:not([data-shown]) .tv-r{opacity:0;translate:0 16px}
.tv-r{transition:opacity .55s ease-out,translate .55s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--i,0)*80ms)}
[data-reveal]:not([data-shown]) .tv-rpop{opacity:0;scale:.8}
.tv-rpop{transition:opacity .3s ease-out,scale .42s cubic-bezier(.34,1.56,.64,1);transition-delay:var(--d,0ms)}
[data-reveal]:not([data-shown]) .tv-rmark{background-size:0 .42em}
.tv-rmark{transition:background-size .6s ease-out;transition-delay:var(--d,300ms)}
[data-reveal]:not([data-shown]) .tv-rdraw{stroke-dashoffset:1}
.tv-rdraw{stroke-dasharray:1;transition:stroke-dashoffset .7s ease-out;transition-delay:var(--d,0ms)}
[data-reveal]:not([data-shown]) .tv-rslide{opacity:0;translate:28px 24px}
.tv-rslide{transition:opacity .45s ease-out,translate .5s cubic-bezier(.16,1,.3,1);transition-delay:var(--d,0ms)}
.tv-faq::details-content{block-size:0;overflow:hidden;transition:block-size .3s ease,content-visibility .3s allow-discrete}
.tv-faq[open]::details-content{block-size:auto}
.tv-marquee{animation:tv-marquee var(--dur,48s) linear infinite}
.tv-marquee[data-dir=right]{animation-direction:reverse}
.tv-fade:hover>.tv-marquee,.tv-band:focus-within .tv-marquee{animation-play-state:paused}
@keyframes tv-marquee{to{translate:calc(-100% / 3) 0}}
.tv-fade{mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
}
@media (prefers-reduced-motion: reduce){
.tv-marquee{width:auto}
.tv-marquee-set{flex-wrap:wrap;justify-content:center;flex-shrink:1;padding-inline:20px}
.tv-marquee-dup{display:none}
}
@media (prefers-reduced-motion: no-preference) and (min-width:1024px){
.tv-swing{transition:rotate .35s cubic-bezier(.16,1,.3,1),translate .35s cubic-bezier(.16,1,.3,1)}
.tv-swing:hover{rotate:0deg;translate:0 -4px}
}
@media (max-width:1023px){.tv-swing{rotate:0deg}}
`;

/**
 * 페이지 루트(`landing.tsx`)에 한 번 둔다. 서버 컴포넌트다. 이스케이프 걱정 없이 그대로
 * 넣으려고 `dangerouslySetInnerHTML` 이다 — 내용은 위 상수뿐이다.
 */
export function TvMotionStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
