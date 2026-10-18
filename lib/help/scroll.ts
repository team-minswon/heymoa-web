/** 사용 가이드의 같은 페이지 안 이동(목차·본문 앵커·같은 페이지 검색 결과)을 한 곳에서 한다. 값은 `app/globals.css` 의 “사용 가이드 모션”. */

const ARRIVE_MS = 1300;
/** `scrollend` 가 없는 브라우저에서 도착으로 보는 시간. */
const ARRIVE_FALLBACK_MS = 700;

export const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let flashed: HTMLElement | null = null;
let flashTimer = 0;

function flash(el: HTMLElement) {
  flashed?.removeAttribute("data-arrived");
  window.clearTimeout(flashTimer);
  el.removeAttribute("data-arrived");
  void el.offsetWidth; // 같은 요소를 다시 눌러도 처음부터 재생한다
  el.setAttribute("data-arrived", "");
  flashed = el;
  flashTimer = window.setTimeout(() => {
    el.removeAttribute("data-arrived");
    flashed = null;
  }, ARRIVE_MS);
}

/**
 * `#id` 섹션으로 부드럽게 스크롤하고, 도착하면 제목 줄을 잠깐 강조한다. 주소는 `replaceState` 로만 바꾼다(라우터 이동·뒤로 가기
 * 스택 없음). 키보드 순서가 이어지도록 제목에 포커스를 둔다. 이미 도착해 있으면 아무것도 안 한다. 움직임 줄이기면 즉시 간다.
 * 돌려주는 값은 포커스를 준 제목이다(대화상자가 닫히며 포커스를 되돌릴 때 쓴다).
 */
export function scrollToSection(id: string): HTMLElement | null {
  const section = document.getElementById(id);
  if (!section) return null;
  const hash = `#${id}`;
  const top = section.getBoundingClientRect().top;
  const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
  const atBottom =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 2;
  if (
    window.location.hash === hash &&
    (Math.abs(top - margin) < 2 || (atBottom && top < window.innerHeight))
  )
    return null;

  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname + window.location.search + hash
  );
  const heading = section.querySelector<HTMLElement>("h2, h3");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
  const row = section.querySelector<HTMLElement>("[data-help-heading]");
  const reduced = prefersReducedMotion();
  section.scrollIntoView({
    behavior: reduced ? "auto" : "smooth",
    block: "start",
  });
  if (row) {
    if (reduced) flash(row);
    else {
      let fired = false;
      const fire = () => {
        if (fired) return;
        fired = true;
        window.removeEventListener("scrollend", fire);
        flash(row);
      };
      window.addEventListener("scrollend", fire, { once: true });
      window.setTimeout(fire, ARRIVE_FALLBACK_MS);
    }
  }
  return heading;
}

/**
 * 같은 페이지를 가리키는 링크(`?q=` 가 바뀌거나 `#섹션` 만 다른 검색 결과)를 라우터 없이 처리한다. 처리했으면 true.
 * 검색어가 바뀌면 `HelpSearch` 가 주소 변화를 보고 일치 위치로 스크롤하고, 같으면 여기서 섹션으로 스크롤한다.
 */
export function goSamePage(href: string): HTMLElement | null | false {
  const url = new URL(href, window.location.href);
  if (
    url.origin !== window.location.origin ||
    url.pathname !== window.location.pathname
  )
    return false;
  if (url.search !== window.location.search) {
    // 상태를 `null` 로 넘겨야 Next 가 `useSearchParams` 에 알린다(자기 상태를 넘기면 건너뛴다) — `HelpSearch` 가 이 변화를 받는다.
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    return null;
  }
  let id = "";
  try {
    id = decodeURIComponent(url.hash.slice(1));
  } catch {
    return false;
  }
  return id ? scrollToSection(id) : false;
}
