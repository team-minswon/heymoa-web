"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useRecording } from "@/components/transcription/recording-provider";

const RECORDING_ERROR_TOAST_ID = "recording-error";

export function RecordingErrorToast() {
  const { error } = useRecording();

  useEffect(() => {
    if (!error) {
      // 복구되면 손으로 닫지 않아도 사라진다.
      toast.dismiss(RECORDING_ERROR_TOAST_ID);
      return;
    }

    // **자동으로 닫지 않는다.** 독에는 되돌릴 수단(다시 시도)만 남기고 사유는 여기로 모았으므로,
    // 이 토스트가 닫히면 사용자가 무엇을 고쳐야 하는지 알 길이 사라진다(마이크 권한 등).
    toast.error(error, { id: RECORDING_ERROR_TOAST_ID, duration: Infinity });
  }, [error]);

  return null;
}
