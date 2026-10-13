import type { BrowserWindow } from "electron";

/**
 * macOS 에서 다른 데스크탑(Space)에 있던 창은 `show()` 만 하면 화면이 그 Space 로 넘어간다.
 * 열기 직전에 모든 Space 에 보이게 했다가 되돌려, 지금 보는 Space 에 창을 띄운다.
 * `skipTransformProcessType` 은 Dock 아이콘이 사라지는 것을 막는다.
 */
export function showOnCurrentSpace(window: BrowserWindow) {
  const pull =
    process.platform === "darwin" &&
    typeof window.setVisibleOnAllWorkspaces === "function";
  if (pull)
    window.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true });
  window.show();
  window.focus();
  if (pull)
    window.setVisibleOnAllWorkspaces(false, { skipTransformProcessType: true });
}
