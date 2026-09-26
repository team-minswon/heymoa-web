"use client";

import { useEffect, useState } from "react";
import { CloudUpload, MicOff, PauseCircle, WifiOff } from "lucide-react";

import type { MicrophoneState } from "@/lib/transcription/audio";
import type {
  BufferState,
  ReconnectState,
} from "@/lib/transcription/realtime-session";

/** 흔한 흔들림은 말하지 않는다. */
const QUIET_MS = 5_000;
const WARN_RATIO = 0.8;

const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1_000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
const minutes = (ms: number) => Math.max(1, Math.ceil(ms / 60_000));

/**
 * 녹음이 **어디까지 남고 있는지**를 말한다. 독의 타이머는 계속 돌아서, 안 알리면 사용자는
 * 모든 구간이 저장되는 줄 안다.
 *
 * 끊겨도 소리는 이 기기(메모리 5분, 디스크 60분)에 쌓이고 붙으면 올라간다. 그래서 「저장 안 됨」이
 * 아니라 「이 기기에 저장 중」이고, 한도에 닿으면 버리지 않고 녹음을 멈춘다.
 */
export function RecordingConnectionNotice({
  reconnecting,
  buffer,
  microphone,
  finishing,
}: {
  reconnecting: ReconnectState | null;
  buffer: BufferState | null;
  microphone: MicrophoneState;
  finishing: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!reconnecting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [reconnecting]);

  // 멈춘 뒤에는 더 받을 소리가 없다. 한도 알림 대신 마무리 진행률을 말한다
  if (buffer?.paused && !finishing) {
    return (
      <Pill role="alert" tone="danger" Icon={PauseCircle}>
        기기에 저장할 수 있는 {minutes(buffer.limitMs)}분이 차서 녹음을 멈췄어요
        · 여기까지는 이 기기에 안전하게 있어요 · 연결되면 이어서 녹음해요
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
  } else if (reconnecting && now - reconnecting.sinceMs > QUIET_MS) {
    lines.push(
      `연결이 불안정해요 · 소리는 이 기기에 저장 중 (${clock(buffer?.pendingMs ?? 0)})`
    );
    if (buffer && !buffer.persistent) {
      lines.push(
        `이 브라우저에서는 ${minutes(buffer.limitMs)}분까지만 저장돼요`
      );
    }
  }
  if (buffer && buffer.pendingMs >= buffer.limitMs * WARN_RATIO) {
    lines.push(
      `약 ${minutes(buffer.limitMs - buffer.pendingMs)}분 뒤 녹음이 멈춰요 · 네트워크를 확인해 주세요`
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
      className={
        tone === "danger"
          ? "pointer-events-auto flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[13px] text-red-800 shadow-e2"
          : "pointer-events-auto flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[13px] text-amber-900 shadow-e2"
      }
    >
      <Icon
        className={`size-4 shrink-0 ${tone === "danger" ? "text-red-600" : "text-amber-600"}`}
      />
      <span className="tabular-nums">{children}</span>
    </div>
  );
}
