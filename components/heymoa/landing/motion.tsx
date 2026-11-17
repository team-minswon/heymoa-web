/*
 * 랜딩의 움직임 전부. 모든 등장 · 그리기 · 반복은 `prefers-reduced-motion: no-preference` 안에만 있어, 규칙 밖 기본값이
 * 곧 다 보이는 끝 상태입니다.
 *
 * - 일시정지(WCAG 2.2.2): `[data-paused]` 아래에서는 클래스를 가리지 않고 모든 애니메이션이 섭니다. `!important` 는 뒤에
 *   오는 `.tv-*` 축약형(`animation:`)이 재생 상태를 running 으로 되돌리지 못하게 하려는 것입니다.
 * - 스크롤에 묶인 움직임(맨 아래 `@supports`): 1024 이상 · 모션 허용 · `animation-timeline` 지원 · 높이 1400 이하에서만
 *   켜지고, `transform` 으로만 움직여 기울임 · 등장 속성과 겹치지 않습니다.
 *   - `tv-land`(놓임): 화면에 들어오며 `--fx` · `--fy` · `--fr` · `--fs` 에서 제자리로 오고(구간의 30%), 머물다가(70%까지),
 *     나가며 `--ty` · `--tr` · `--ts` 로 흘러갑니다. 값은 style 로 줍니다. 주석이 가리키는 자리는 머무는 동안 맞습니다.
 *     이 값들은 `@property` 로 **물려주지 않게** 등록했습니다 — 놓임 안의 놓임이 바깥의 나가는 값까지 받기 때문입니다.
 *   - `tv-orb`: 문서 맨 위에서 `--oe`(기본 900px)만큼 내려가는 동안 `--ox` · `--oy` · `--or` · `--os` 로 갑니다.
 * - `.tv-row` 규칙은 Tailwind 임의 변형으로 옮기지 않습니다 — `:has()` 안의 쉼표 · `~` · `>` 를 클래스 이름에 담을 수 없습니다.
 * - `scroll-padding-top` 은 상단 바 높이(`h-16`)입니다. 구간마다 `scroll-mt-*` 를 또 걸면 둘이 더해집니다.
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

export function TvMotionStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
