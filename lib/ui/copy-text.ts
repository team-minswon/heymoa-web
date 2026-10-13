/**
 * 텍스트를 클립보드에 넣는다. 실패하면 reject한다 — 삼키면 사용자는 복사된 줄 안다.
 *
 * `navigator.clipboard` 는 포커스가 없거나 권한 정책이 막거나 안전하지 않은 출처이면 없거나
 * 거부한다. 그때 같은 사용자 동작 안에서 `execCommand("copy")` 로 한 번 더 시도한다.
 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (error) {
    if (!execCommandCopy(text)) throw error;
  }
}

function execCommandCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  const active = document.activeElement;
  document.body.appendChild(area);
  try {
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    if (active instanceof HTMLElement) active.focus();
  }
}
