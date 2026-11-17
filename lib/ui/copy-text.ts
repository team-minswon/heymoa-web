/** `navigator.clipboard` 는 포커스·권한 정책·안전하지 않은 출처에서 없거나 거부해서 `execCommand("copy")` 로 한 번 더 시도합니다. */
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
