// 녹화에 포함되는 커서. 실제 DOM click에서만 물결을 만든다.
export function installCursor() {
  const mount = () => {
    const style = document.createElement("style");
    style.textContent = `nextjs-portal{display:none!important} *{cursor:none!important}
      html:has(iframe:hover)>#help-cursor{visibility:hidden} #help-cursor{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483647;width:22px;height:26px;filter:drop-shadow(0 1px 2px #0005)}
      .help-ripple{position:fixed;width:18px;height:18px;border:3px solid #5a3df0;border-radius:50%;pointer-events:none;z-index:2147483646;animation:help-ripple .6s ease-out forwards}
      @keyframes help-ripple{from{transform:translate(-50%,-50%) scale(.5);opacity:.9}to{transform:translate(-50%,-50%) scale(3);opacity:0}}`;
    document.head.append(style);
    const cursor = document.createElement("div");
    cursor.id = "help-cursor";
    cursor.innerHTML =
      '<svg viewBox="0 0 24 28"><path d="M3 2L4 23L9 17L14 26L18 24L13 15L21 14Z" fill="white" stroke="#332560" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    document.documentElement.append(cursor);
    document.addEventListener("mousemove", (e) => {
      cursor.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    });
    document.addEventListener(
      "click",
      (e) => {
        if (window.__helpQuiet) return; // 장면 준비용 클릭은 물결을 만들지 않는다
        const ring = document.createElement("div");
        ring.className = "help-ripple";
        ring.style.left = `${e.clientX}px`;
        ring.style.top = `${e.clientY}px`;
        document.documentElement.append(ring);
        ring.addEventListener("animationend", () => ring.remove(), {
          once: true,
        });
      },
      true
    );
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
}

const positions = new WeakMap();

/** 영상에 담기지 않을 준비 클릭(커서·물결 없이). 이 절과 상관없는 패널을 치울 때 쓴다. */
export async function quietClick(page, target) {
  await page.evaluate(() => (window.__helpQuiet = true));
  await target.click();
  await page.evaluate(() => (window.__helpQuiet = false));
}
/** `hold`: 커서가 대상 위에 멈춰 있는 시간(ms). 눌리기 전에 어디를 누르는지 보이게 한다. */
export async function click(page, target, pause = 700, hold = 150) {
  await target.waitFor({ state: "visible" });
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("클릭할 요소의 위치가 없습니다.");
  const vp = page.viewportSize();
  const from = positions.get(page) || { x: vp.width - 180, y: vp.height - 60 };
  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  for (let step = 1; step <= 24; step++) {
    const t = step / 24;
    const eased = t * t * (3 - 2 * t);
    await page.mouse.move(
      from.x + (to.x - from.x) * eased,
      from.y + (to.y - from.y) * eased
    );
    await page.waitForTimeout(12);
  }
  positions.set(page, to);
  await page.waitForTimeout(hold);
  // Locator의 actionability 검사와 실제 마우스 click을 함께 사용한다.
  await target.click();
  await page.waitForTimeout(pause);
}

export async function type(page, target, text, { hold = 150, delay = 50 } = {}) {
  await click(page, target, 0, hold);
  await target.fill("");
  // insertText는 한글에도 동작한다. pressSequentially의 한글 delay 누락을 피한다.
  for (const letter of text) {
    await page.keyboard.insertText(letter);
    await page.waitForTimeout(delay);
  }
}
