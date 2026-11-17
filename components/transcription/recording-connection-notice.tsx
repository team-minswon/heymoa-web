"use client";

import { CloudUpload, MicOff, PauseCircle, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";

import type { MicrophoneState } from "@/lib/transcription/audio";
import type {
  BufferState,
  ConnectionNotice,
} from "@/lib/transcription/realtime-session";

const seconds = (ms: number) => Math.max(1, Math.round(ms / 1_000));

export function RecordingConnectionNotice({
  notice,
  buffer,
  microphone,
  systemAudio = null,
  finishing,
}: {
  notice: ConnectionNotice | null;
  buffer: BufferState | null;
  microphone: MicrophoneState;
  systemAudio?: MicrophoneState | null;
  finishing: boolean;
}) {
  const t = useTranslations("recording.connection");
  if (buffer?.paused && !finishing) {
    return (
      <Pill role="alert" tone="danger" Icon={PauseCircle}>
        {t("bufferPaused")}
      </Pill>
    );
  }

  const lines: string[] = [];
  if (microphone !== "live") {
    lines.push(t("microphoneLost"));
  }
  if (systemAudio !== null && systemAudio !== "live") {
    lines.push(t("systemAudioLost"));
  }
  if (buffer?.upload) {
    lines.push(
      finishing
        ? t("finishingUpload", { percent: buffer.upload.percent })
        : t("uploading", { percent: buffer.upload.percent })
    );
  } else if (notice && finishing) {
    lines.push(
      t("pendingOnDevice", { seconds: seconds(buffer?.pendingMs ?? 0) })
    );
  } else if (notice) {
    lines.push(t("disconnected"));
  }
  if (lines.length === 0) return null;

  const Icon =
    microphone !== "live" ? MicOff : buffer?.upload ? CloudUpload : WifiOff;
  return (
    <Pill role="status" tone="warning" Icon={Icon}>
      {lines.map((line) => (
        <span key={line} className="block">
          {line}
        </span>
      ))}
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
      className="pointer-events-auto flex w-max max-w-[min(36rem,calc(100vw-2rem))] items-start gap-2 rounded-2xl border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] px-3 py-1.5 text-[13px] text-[var(--el-ink)] shadow-e2 backdrop-blur-xl"
    >
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${tone === "danger" ? "text-destructive" : "text-amber-600"}`}
      />
      <span className="min-w-0 whitespace-normal break-words tabular-nums">
        {children}
      </span>
    </div>
  );
}
