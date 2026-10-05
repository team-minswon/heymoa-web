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
  document.querySelectorAll<HTMLButtonElement>("button")
);
const labels: Record<OnboardingView["microphone"], string> = {
  "not-determined": "아직 확인하지 않음",
  granted: "허용됨",
  denied: "허용이 필요해요",
  restricted: "기기에서 제한됨",
  unknown: "설정에서 확인",
};
function render(view: OnboardingView) {
  element("microphone-status").textContent = labels[view.microphone];
  element("microphone-status").dataset.state = view.microphone;
  microphone.textContent =
    view.microphone === "granted"
      ? "허용됨"
      : view.platform === "darwin" && view.microphone === "not-determined"
        ? "마이크 허용"
        : "설정 열기";
  microphone.disabled = view.microphone === "granted";
  element("audio-description").textContent =
    view.platform === "darwin"
      ? "Zoom·Webex 등 컴퓨터에서 들리는 소리입니다. 첫 녹음 때 macOS가 필요한 허용을 요청합니다. 설정의 화면 및 시스템 오디오 녹음에서 HeyMoa를 확인할 수 있어요."
      : "Zoom·Webex 등 컴퓨터에서 들리는 소리입니다. Windows 출력 장치의 소리를 첫 녹음 때 연결합니다. 헤드셋이나 스피커 설정을 확인해 주세요.";
  complete.textContent =
    view.microphone === "granted"
      ? "HeyMoa 시작하기"
      : "나중에 설정하고 시작하기";
}
let pending = false;
async function action(value: OnboardingAction) {
  if (pending) return;
  pending = true;
  controls.forEach((control) => {
    control.disabled = true;
  });
  element("error").textContent = "";
  try {
    render(await window.heymoaOnboarding.action(value));
  } catch {
    element("error").textContent =
      value === "complete"
        ? "시작 설정을 저장하지 못했습니다. 다시 시도해 주세요."
        : "설정을 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.";
  } finally {
    pending = false;
    controls.forEach((control) => {
      if (
        control !== microphone ||
        element("microphone-status").dataset.state !== "granted"
      )
        control.disabled = false;
    });
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
void action("read");
