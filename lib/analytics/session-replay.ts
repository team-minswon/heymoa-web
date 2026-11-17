import type { PostHogConfig } from "posthog-js";

export const SESSION_REPLAY_EFFECTIVE = "2026-11-18";

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
  // rrweb 메타 주소에도 OAuth code·초대 토큰이 붙습니다.
  maskCapturedNetworkRequestFn: (request) => ({
    name: request.name.split(/[?#]/)[0],
    entryType: request.entryType,
    startTime: request.startTime,
    duration: request.duration,
  }),
} satisfies PostHogConfig["session_recording"];
