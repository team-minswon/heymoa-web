import type { RecordingSummary } from "@heymoa/desktop-contracts";
export type { RecordingSummary } from "@heymoa/desktop-contracts";

export const PRODUCTION_ORIGIN = "https://heymoa.app";
export const BRIDGE_VERSION = 1;
export const CHANNELS = {
  capabilities: "heymoa:capabilities",
  summary: "heymoa:recording-summary",
  captureBegin: "heymoa:capture-begin",
  captureReady: "heymoa:capture-ready",
  captureEnd: "heymoa:capture-end",
  recordingAction: "heymoa:recording-action",
} as const;

function parseWebUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url
      : null;
  } catch {
    return null;
  }
}
export function applicationUrl(
  packaged: boolean,
  developmentUrl?: string
): string {
  if (packaged || !developmentUrl) return PRODUCTION_ORIGIN;
  const url = parseWebUrl(developmentUrl);
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("개발 URL은 loopback 주소만 사용할 수 있습니다.");
  return url.href;
}
export function isTrustedUrl(value: string, origin: string): boolean {
  return parseWebUrl(value)?.origin === origin;
}
export function externalUrl(value: string, origin: string): string | null {
  const url = parseWebUrl(value);
  return url && url.origin !== origin ? url.href : null;
}
export function trustedSender(
  sender: unknown,
  expectedSender: unknown,
  frame: unknown,
  mainFrame: unknown,
  frameUrl: string,
  origin: string
): boolean {
  return (
    sender === expectedSender &&
    frame !== null &&
    frame !== undefined &&
    frame === mainFrame &&
    isTrustedUrl(frameUrl, origin)
  );
}
export type Support = { supported: boolean; reason: string | null };
export function platformSupport(
  platform: string,
  arch: string,
  version: string
): Support {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version);
  if (!match)
    return { supported: false, reason: "운영체제 버전을 확인하지 못했습니다." };
  const [major, minor, patch] = match.slice(1).map(Number);
  if (
    platform === "darwin" &&
    ["arm64", "x64"].includes(arch) &&
    (major > 14 || (major === 14 && minor >= 2))
  )
    return { supported: true, reason: null };
  if (
    platform === "win32" &&
    arch === "x64" &&
    major === 10 &&
    minor === 0 &&
    patch >= 22000
  )
    return { supported: true, reason: null };
  return {
    supported: false,
    reason:
      "HeyMoa 데스크톱은 macOS 14.2 이상(Apple Silicon·Intel), Windows 11 x64를 지원합니다.",
  };
}
const PHASES = [
  "idle",
  "requesting-permission",
  "connecting",
  "recording",
  "stopping",
  "completed",
  "failed",
] as const;
const INPUT_STATES = [null, "live", "muted", "ended", "suspended"];
export function recordingSummary(value: unknown): RecordingSummary {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_RECORDING_SUMMARY");
  const v = value as Record<string, unknown>;
  const keys = ["phase", "startedAt", "pendingMs", "microphone", "systemAudio"];
  if (
    Object.keys(v).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(v, key)) ||
    !PHASES.includes(v.phase as RecordingSummary["phase"]) ||
    !(
      v.startedAt === null ||
      (Number.isSafeInteger(v.startedAt) && (v.startedAt as number) >= 0)
    ) ||
    !Number.isSafeInteger(v.pendingMs) ||
    (v.pendingMs as number) < 0 ||
    (v.pendingMs as number) > 300000 ||
    !INPUT_STATES.includes(v.microphone as null | string) ||
    !INPUT_STATES.includes(v.systemAudio as null | string)
  )
    throw new Error("INVALID_RECORDING_SUMMARY");
  return {
    phase: v.phase,
    startedAt: v.startedAt,
    pendingMs: v.pendingMs,
    microphone: v.microphone,
    systemAudio: v.systemAudio,
  } as RecordingSummary;
}
export function emptyRequest(value: unknown): boolean {
  return value === undefined;
}
