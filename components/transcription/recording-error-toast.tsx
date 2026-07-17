"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useRecording } from "@/components/transcription/recording-provider";

const RECORDING_ERROR_TOAST_ID = "recording-error";

export function RecordingErrorToast() {
  const { error } = useRecording();

  useEffect(() => {
    if (!error) return;

    toast.error(error, { id: RECORDING_ERROR_TOAST_ID });
  }, [error]);

  return null;
}
