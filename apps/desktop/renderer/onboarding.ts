import { localize } from "./i18n";
import { getLanguage } from "../src/i18n";
import { t } from "../src/i18n";
import type { OnboardingAction, OnboardingView } from "../src/onboarding";

declare global {
  interface Window {
    heymoaOnboarding: {
      action(value: OnboardingAction): Promise<OnboardingView>;
    };
  }
}
const element = (id: string) => document.getElementById(id)!;
const microphone = element("microphone-action") as HTMLButtonElement;
const complete = element("complete") as HTMLButtonElement;
const controls = Array.from(
  document.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button, select")
);
const labels: Record<OnboardingView["microphone"], string> = {
  "not-determined": "아직 확인하지 않음",
  granted: "허용됨",
  denied: "허용이 필요해요",
  restricted: "기기에서 제한됨",
  unknown: "설정에서 확인",
};
function render(view: OnboardingView) {
  localize(view.language ?? "ko");
  (element("language") as HTMLSelectElement).value = getLanguage();
  element("microphone-status").textContent = t(labels[view.microphone]);
  element("microphone-status").dataset.state = view.microphone;
  microphone.textContent =
    view.microphone === "granted"
      ? t("허용됨")
      : view.platform === "darwin" && view.microphone === "not-determined"
        ? t("마이크 허용")
        : t("설정 열기");
  microphone.disabled = view.microphone === "granted";
  element("audio-description").textContent =
    view.platform === "darwin"
      ? t("화상회의 상대방이나 강의에서 듣는 말입니다. 첫 녹음 때 macOS가 권한을 요청하면 허용해 주세요.")
      : t("Zoom·Webex 등 컴퓨터에서 들리는 소리입니다. Windows 출력 장치의 소리를 첫 녹음 때 연결합니다. 헤드셋이나 스피커 설정을 확인해 주세요.");
  element("audio-action").hidden = view.platform === "darwin";
  complete.textContent =
    view.microphone === "granted"
      ? t("HeyMoa 시작하기")
      : t("나중에 설정하고 시작하기");
}
let pending = false;
let queued: OnboardingAction | undefined;
async function action(value: OnboardingAction) {
  if (pending) {
    if (value !== "read") queued = value;
    return;
  }
  pending = true;
  // A focus refresh must not dismiss an open native language picker.
  controls.forEach((control) => {
    if (value !== "read" || control.tagName !== "SELECT") control.disabled = true;
  });
  element("error").textContent = "";
  try {
    render(await window.heymoaOnboarding.action(value));
  } catch {
    (element("language") as HTMLSelectElement).value = getLanguage();
    element("error").textContent =
      value === "complete"
        ? t("시작 설정을 저장하지 못했습니다. 다시 시도해 주세요.")
        : t("설정을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.");
  } finally {
    pending = false;
    controls.forEach((control) => {
      if (
        control !== microphone ||
        element("microphone-status").dataset.state !== "granted"
      )
        control.disabled = false;
    });
    const next = queued;
    queued = undefined;
    if (next) void action(next);
  }
}
microphone.addEventListener("click", () => void action("microphone"));
element("audio-action").addEventListener(
  "click",
  () => void action("audio-settings")
);
element("recheck").addEventListener("click", () => void action("read"));
complete.addEventListener("click", () => void action("complete"));
window.addEventListener("focus", () => void action("read"));
element("language").addEventListener("change", () => {
  const language = (element("language") as HTMLSelectElement).value;
  if (language === "ko" || language === "en") void action(`language-${language}`);
});
void action("read");
