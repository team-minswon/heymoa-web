import { prefersReducedMotion } from "@/lib/utils";

const ARRIVE_MS = 1300;
const ARRIVE_FALLBACK_MS = 700;

let flashed: HTMLElement | null = null;
let flashTimer = 0;

function flash(el: HTMLElement) {
  flashed?.removeAttribute("data-arrived");
  window.clearTimeout(flashTimer);
  el.removeAttribute("data-arrived");
  void el.offsetWidth; // 같은 요소를 다시 눌러도 처음부터 재생합니다(강제 리플로)
  el.setAttribute("data-arrived", "");
  flashed = el;
  flashTimer = window.setTimeout(() => {
    el.removeAttribute("data-arrived");
    flashed = null;
  }, ARRIVE_MS);
}

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

export function goSamePage(href: string): HTMLElement | null | false {
  const url = new URL(href, window.location.href);
  if (
    url.origin !== window.location.origin ||
    url.pathname !== window.location.pathname
  )
    return false;
  if (url.search !== window.location.search) {
    // 상태를 null 로 넘겨야 Next 가 useSearchParams 에 알립니다(자기 상태를 넘기면 건너뜁니다).
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
