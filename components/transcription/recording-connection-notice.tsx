"use client";

import { CloudUpload, MicOff, PauseCircle, WifiOff } from "lucide-react";

import type { MicrophoneState } from "@/lib/transcription/audio";
import type {
  BufferState,
  ConnectionNotice,
} from "@/lib/transcription/realtime-session";

const seconds = (ms: number) => Math.max(1, Math.round(ms / 1_000));

/**
 * 녹음이 **어디까지 남고 있는지**를 말한다. 독의 타이머는 계속 돌아서, 안 알리면 사용자는
 * 모든 구간이 저장되는 줄 안다.
 *
 * 끊기면 받아쓰기와 실시간 분석이 먼저 멈추므로 그것부터 말한다. 소리는 30초 창 동안 이 기기
 * 메모리에 쌓이고, 붙으면 올라간다. 창이 끝난 뒤의 멈춤은 오류 토스트가 말한다.
 */
export function RecordingConnectionNotice({
  notice,
  buffer,
  microphone,
  finishing,
}: {
  notice: ConnectionNotice | null;
  buffer: BufferState | null;
  microphone: MicrophoneState;
  finishing: boolean;
}) {
  // 붙어 있는데 서버 저장이 밀려 메모리 한도에 닿았다. 끊긴 채로는 창(30초)이 먼저 닫힌다
  if (buffer?.paused && !notice && !finishing) {
    return (
      <Pill role="alert" tone="danger" Icon={PauseCircle}>
        저장이 밀려 녹음을 잠시 멈췄어요 · 저장되면 이어서 녹음해요
      </Pill>
    );
  }

  const lines: string[] = [];
  if (microphone !== "live") {
    lines.push("마이크가 끊겼습니다. 이 동안의 소리는 녹음되지 않습니다.");
  }
  if (buffer?.upload) {
    lines.push(
      finishing
        ? `저장 마무리 중… ${buffer.upload.percent}%`
        : `밀린 소리 올리는 중 ${buffer.upload.percent}%`
    );
  } else if (notice && finishing) {
    lines.push(
      `올릴 소리 ${seconds(buffer?.pendingMs ?? 0)}초가 이 기기에 있어요 · 연결될 때까지 이 탭을 열어 두세요`
    );
  } else if (notice) {
    lines.push(
      "연결이 끊겼어요 · 받아쓰기·실시간 분석 멈춤 · 녹음은 이 기기에 저장 중"
    );
  }
  if (lines.length === 0) return null;

  const Icon =
    microphone !== "live" ? MicOff : buffer?.upload ? CloudUpload : WifiOff;
  return (
    <Pill role="status" tone="warning" Icon={Icon}>
      {lines.join(" · ")}
    </Pill>
  );
}

/** 모양은 `RecordingDegradedNotice` 와 같다. 경고색 토큰이 없어 아이콘만 물들인다. */
function Pill({
  role,
  tone,
  Icon,
  children,
}: {
  role: "status" | "alert";
  tone: "warning" | "danger";
  Icon: typeof WifiOff;
  children: React.ReactNode;
}) {
  return (
    <div
      role={role}
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] px-3 py-1.5 text-[13px] text-[var(--el-ink)] shadow-e2 backdrop-blur-xl"
    >
      <Icon
        className={`size-4 shrink-0 ${tone === "danger" ? "text-destructive" : "text-amber-600"}`}
      />
      <span className="tabular-nums">{children}</span>
    </div>
  );
}
