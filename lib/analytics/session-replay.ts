import type { PostHogConfig } from "posthog-js";

/** 처리방침 공고 뒤 시행하는 날. 페이지의 시행일과 녹화 시작 기준이 같은 값을 읽습니다. */
export const SESSION_REPLAY_EFFECTIVE = "2026-11-18";

/** 본문뿐 아니라 title·data-*·링크 속성에도 회의 정보가 있어 모두 가립니다. */
export const SESSION_REPLAY_CONFIG = {
  maskAllInputs: true,
  maskTextSelector: "*",
  maskAllElementAttributes: true,
  blockSelector:
    'input[type="hidden"], input[type="file"], img, picture, audio, video, source, canvas, iframe, object, embed, svg image',
  recordCrossOriginIframes: false,
  captureCanvas: { recordCanvas: false },
  captureJsonLd: false,
  slimDOMOptions: "all",
  recordHeaders: false,
  recordBody: false,
  // rrweb 메타 주소에도 OAuth code·초대 토큰이 붙습니다. 네트워크 본문은 받지 않습니다.
  maskCapturedNetworkRequestFn: (request) => ({
    name: request.name.split(/[?#]/)[0],
    entryType: request.entryType,
    startTime: request.startTime,
    duration: request.duration,
  }),
} satisfies PostHogConfig["session_recording"];
