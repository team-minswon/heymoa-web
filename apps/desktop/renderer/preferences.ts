import { localize } from "./i18n";
import { t } from "../src/i18n";
import type {
  DesktopPreferencesAction,
  DesktopPreferencesView,
} from "../src/desktop-preferences";
const bridge = (
  window as unknown as {
    heymoaPreferences: {
      action(
        value: "read" | DesktopPreferencesAction
      ): Promise<DesktopPreferencesView>;
      subscribe(listener: (view: DesktopPreferencesView) => void): () => void;
    };
  }
).heymoaPreferences;
const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const opacity = element<HTMLInputElement>("opacity"),
  automatic = element<HTMLInputElement>("automatic"),
  check = element<HTMLButtonElement>("check"),
  restart = element<HTMLButtonElement>("restart");
let pending = false;
let current: DesktopPreferencesView | null = null;
let errorSource: string | null = null;
const statuses: Record<DesktopPreferencesView["update"]["status"], string> = {
  idle: "새 버전을 확인할 수 있습니다.",
  checking: "새 버전을 확인하고 있습니다.",
  current: "최신 버전을 사용하고 있습니다.",
  available: "새 버전 {version}을 사용할 수 있습니다.",
  downloading: "버전 {version} 다운로드 중 · {percent}%",
  ready: "버전 {version}을 적용할 준비가 됐습니다.",
  installing: "업데이트를 적용하고 있습니다.",
  error: "업데이트하지 못했습니다. 다시 시도해 주세요.",
  unavailable: "이 실행 환경에서는 업데이트를 지원하지 않습니다.",
};
function render(view: DesktopPreferencesView) {
  current = view;
  localize(view.language);
  element("error").textContent = errorSource ? t(errorSource) : "";
  if (document.activeElement !== opacity)
    opacity.value = String(Math.round(view.opacity * 100));
  element("opacity-value").textContent = `${opacity.value}%`;
  automatic.checked = view.update.automatic;
  const state = view.update;
  opacity.disabled = pending || state.status === "installing";
  automatic.disabled =
    pending || state.status === "unavailable" || state.status === "installing";
  element("version").textContent = t("현재 버전 {version}").replace(
    "{version}",
    state.currentVersion
  );
  element("status").textContent = t(statuses[state.status])
    .replace("{version}", state.version ?? "")
    .replace("{percent}", String(state.percent ?? 0));
  const progress = element<HTMLProgressElement>("progress");
  progress.hidden = state.status !== "downloading";
  progress.value = state.percent ?? 0;
  check.hidden = state.status === "ready" || state.status === "installing";
  check.textContent = t(
    state.status === "available" ? "다운로드" : "업데이트 확인"
  );
  check.disabled =
    pending ||
    ["checking", "downloading", "installing", "unavailable"].includes(
      state.status
    );
  restart.hidden = state.status !== "ready";
  restart.disabled = pending || !state.canRestart;
  element("blocked").hidden = state.status !== "ready" || state.canRestart;
}
async function action(value: "read" | DesktopPreferencesAction) {
  if (pending) return;
  pending = true;
  errorSource = null;
  if (current) render(current);
  element("error").textContent = "";
  try {
    const view = await bridge.action(value);
    pending = false;
    render(view);
  } catch {
    pending = false;
    errorSource = "설정을 저장하지 못했습니다. 다시 시도해 주세요.";
    if (current) {
      opacity.value = String(Math.round(current.opacity * 100));
      render(current);
    }
    element("error").textContent = t(errorSource);
  }
}
opacity.addEventListener("input", () => {
  element("opacity-value").textContent = `${opacity.value}%`;
});
opacity.addEventListener(
  "change",
  () => void action({ action: "opacity", value: Number(opacity.value) / 100 })
);
automatic.addEventListener(
  "change",
  () => void action({ action: "automatic", value: automatic.checked })
);
check.addEventListener("click", () => void action("check"));
restart.addEventListener("click", () => void action("restart"));
let received = false;
const unsubscribe = bridge.subscribe((view) => {
  received = true;
  render(view);
});
void bridge
  .action("read")
  .then((view) => {
    if (!received) render(view);
  })
  .catch(() => {
    errorSource = "설정을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.";
    element("error").textContent = t(errorSource);
  });
window.addEventListener("unload", unsubscribe, { once: true });
