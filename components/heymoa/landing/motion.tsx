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
 * - 스크롤에 묶인 움직임(APP-1604, 맨 아래 `@supports` 블록): **스크롤이 손이다** — 종이는 내려가는 만큼 제자리에
 *   내려앉고, 형광펜 · 취소선은 내려가는 만큼 그어진다. 넓은 화면(1024 이상) · 모션 허용 · `animation-timeline`
 *   지원이 다 맞고 화면 높이가 1400 이하일 때만 켜지고, 하나라도 아니면 위의 한 번짜리 등장 그대로다(끝 상태가
 *   기본값인 것도 같다). 높이를 묶은 까닭: 화면이 아주 높으면 문서 끝에 가까운 것(마무리 면 · 당번표 · 물결)이
 *   구간을 다 지나기 전에 스크롤이 끝나 중간 모습으로 멈추고, 회의 카드는 첫 화면에서 반쯤 펼쳐진 채 보인다.
 *   전부 `transform` 으로만 움직인다 — 기울임(`rotate`) · 등장(`translate` · `scale` · `opacity`) · 올림(`tv-swing`)이
 *   쓰는 속성과 겹치지 않아 같은 요소에 얹어도 서로 덮지 않는다.
 *   - `tv-land`(놓임): 화면에 들어오며 `--fx` · `--fy` · `--fr` · `--fs` 에서 제자리로 오고(구간의 30%), 머물다가(70%까지),
 *     나가며 `--ty` · `--tr` · `--ts` 로 흘러간다. 값은 style 로 준다. 주석이 가리키는 자리는 머무는 동안 맞는다.
 *     이 값들은 `@property` 로 **물려주지 않게** 등록했다 — 놓임 안에 놓임이 있으면(색 면 안의 창) 안쪽이 바깥의
 *     나가는 값까지 받아 같이 물러났다.
 *   - `tv-orb`: 문서 맨 위에서 `--oe`(기본 900px)만큼 내려가는 동안 `--ox` · `--oy` · `--or` · `--os` 로 간다(히어로의 원 · 말풍선).
 *   - `tv-rmark`(형광펜): 화면 높이의 86% → 58% 를 지나는 동안 칠해진다. 되올리면 지워진다.
 *   - `tv-roster` · `tv-loop`(마무리): 그 상자가 지나는 동안 안쪽 `tv-rdraw` 가 그어진다(이름은 `--k` 차례로). 당번표의
 *     손글씨 두 줄(`tv-rpop`)도 같은 줄자에 묶어 이름이 다 그어진 뒤에 나온다 — 시간으로 두면 천천히 내릴 때
 *     이름이 그어지기 전에 「받아 적기 — HeyMoa」가 먼저 떴다.
 *   - `tv-stamp`(출입증 도장): 큰 채로 내려와 찍힌다. `tv-wave`(푸터 물결): 높게 일었다가 가라앉는다.
 *   - 흐르는 띠(`tv-band` 안 `tv-marquee`): 구간이 지나는 동안 제 방향으로 180px 더 간다. 올려 둔 줄 · 일시정지는
 *     시간으로 흐르는 쪽만 세우고 스크롤 쪽은 두어, 다시 흐를 때 줄이 튀지 않는다.
 * `.chat-shimmer` · `.chat-rise` 는 전역(`globals.css`)이라 창 안에서 그대로 쓴다.
 *
 * 움직임이 아닌 규칙이 하나 섞여 있다 — `.tv-row`(`app.tsx` `ROW_LINE`, 검토 줄 · 스크립트 줄): **뒤에 줄이
 * 없으면 아래 선을 지운다.** 잘라 보인 창 · 카드에서 마지막 줄 선이 프레임 바닥 바로 위에 남아 바닥이 두 겹으로
 * 읽혔다. 「뒤에 줄」은 줄 자신의 뒤 형제(`~.tv-row`)이거나, 줄을 한 겹 감싼 칸의 뒤 형제(`~*>.tv-row`)다 —
 * 구간들이 줄을 한 칸씩 감싸서(히어로 `data-row`, 근거 구간 번호표 칸) `:last-child` 로는 가를 수 없다.
 * Tailwind 임의 변형 대신 여기 두는 까닭은 `:has()` 안의 쉼표 · `~` · `>` 를 클래스 이름으로 옮기지 않으려는 것.
 * 층(@layer) 밖 규칙이라 구간의 `border-b` 유틸리티로는 되살리지 못한다(되살릴 자리가 지금 없다).
 *
 * `scroll-padding-top` 은 상단 바 높이(`top-bar.tsx` `h-16`)다 — 메뉴로 구간에 가면 구간 윗변이 바 바로 아래에
 * 선다. 구간마다 `scroll-mt-*` 를 또 걸지 않는다: 둘은 더해져서, 전에 5rem + 5rem 이 바 아래로 96px 를 비워
 * 앞 구간 끝이 비쳐 보였다.
 */
const CSS = `
.tv-row:not(:has(~.tv-row,~*>.tv-row)):not(:has(~.tv-row,~*>.tv-row)>*){border-bottom-width:0}
.tv-swing{rotate:var(--tilt,0deg)}
html{scroll-padding-top:4rem}
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
@property --fx{syntax:"<length>";inherits:false;initial-value:0px}
@property --fy{syntax:"<length>";inherits:false;initial-value:0px}
@property --fr{syntax:"<angle>";inherits:false;initial-value:0deg}
@property --fs{syntax:"<number>";inherits:false;initial-value:1}
@property --ty{syntax:"<length>";inherits:false;initial-value:0px}
@property --tr{syntax:"<angle>";inherits:false;initial-value:0deg}
@property --ts{syntax:"<number>";inherits:false;initial-value:1}
@property --ox{syntax:"<length>";inherits:false;initial-value:0px}
@property --oy{syntax:"<length>";inherits:false;initial-value:0px}
@property --or{syntax:"<angle>";inherits:false;initial-value:0deg}
@property --os{syntax:"<number>";inherits:false;initial-value:1}
@supports (animation-timeline:view()){
@media (prefers-reduced-motion: no-preference) and (min-width:1024px) and (max-height:1400px){
.tv-land{animation:tv-land linear both;animation-timeline:view();animation-range:cover 0% cover 100%}
@keyframes tv-land{0%{transform:translate(var(--fx,0px),var(--fy,0px)) rotate(var(--fr,0deg)) scale(var(--fs,1));animation-timing-function:cubic-bezier(.3,.3,.5,1)}30%,70%{transform:translate(0px,0px) rotate(0deg) scale(1);animation-timing-function:cubic-bezier(.5,0,.85,.7)}100%{transform:translate(0px,var(--ty,0px)) rotate(var(--tr,0deg)) scale(var(--ts,1))}}
.tv-orb{animation:tv-orb linear both;animation-timeline:scroll(root);animation-range:0px var(--oe,900px)}
@keyframes tv-orb{to{transform:translate(var(--ox,0px),var(--oy,0px)) rotate(var(--or,0deg)) scale(var(--os,1))}}
.tv-pop.tv-orb{animation:tv-pop .34s cubic-bezier(.34,1.56,.64,1) both,tv-orb linear both;animation-delay:var(--d,0ms),0s;animation-timeline:auto,scroll(root);animation-range:normal,0px var(--oe,900px)}
[data-reveal]:not([data-shown]) .tv-rmark{background-size:revert-layer}
.tv-rmark{transition:none;animation:tv-smark linear both;animation-timeline:view();animation-range:cover 14% cover 42%}
@keyframes tv-smark{from{background-size:0 .42em}}
.tv-roster{view-timeline-name:--tv-roster}
.tv-loop{view-timeline-name:--tv-loop}
[data-reveal]:not([data-shown]) :is(.tv-roster,.tv-loop) .tv-rdraw{stroke-dashoffset:0}
:is(.tv-roster,.tv-loop) .tv-rdraw{transition:none;animation:tv-sdraw linear both}
.tv-roster .tv-rdraw{animation-timeline:--tv-roster;animation-range:cover calc(26% + var(--k,0)*4%) cover calc(34% + var(--k,0)*4%)}
[data-reveal]:not([data-shown]) .tv-roster .tv-rpop{opacity:1;scale:1}
.tv-roster .tv-rpop{transition:none;animation:tv-spop linear both;animation-timeline:--tv-roster;animation-range:cover calc(44% + var(--k,0)*4%) cover calc(50% + var(--k,0)*4%)}
@keyframes tv-spop{from{opacity:0;transform:scale(.8)}}
.tv-loop .tv-rdraw{animation-timeline:--tv-loop;animation-range:cover 20% cover 48%}
@keyframes tv-sdraw{from{stroke-dashoffset:1}}
[data-reveal]:not([data-shown]) .tv-stamp{scale:1}
.tv-stamp{animation:tv-stamp linear both;animation-timeline:view();animation-range:cover 10% cover 32%}
@keyframes tv-stamp{0%{opacity:0;transform:scale(2) rotate(var(--sr,-16deg));animation-timing-function:cubic-bezier(.6,0,.9,.5)}55%{opacity:1}100%{opacity:1;transform:scale(1) rotate(0deg)}}
.tv-wave{transform-origin:50% 100%;animation:tv-wave linear both;animation-timeline:view();animation-range:cover 0% cover 30%}
@keyframes tv-wave{from{transform:scaleY(2.6)}}
.tv-band{view-timeline-name:--tv-band}
.tv-band .tv-marquee{animation:tv-marquee var(--dur,48s) linear infinite,tv-shift linear both;animation-timeline:auto,--tv-band}
.tv-band .tv-marquee[data-dir=right]{animation-direction:reverse}
.tv-band .tv-fade:hover>.tv-marquee,.tv-band:focus-within .tv-marquee{animation-play-state:paused,running}
.tv-band[data-paused] .tv-marquee{animation-play-state:paused,running!important}
@keyframes tv-shift{to{transform:translateX(-180px)}}
}
}
`;

/**
 * 페이지 루트(`landing.tsx`)에 한 번 둔다. 서버 컴포넌트다. 이스케이프 걱정 없이 그대로
 * 넣으려고 `dangerouslySetInnerHTML` 이다 — 내용은 위 상수뿐이다.
 */
export function TvMotionStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
