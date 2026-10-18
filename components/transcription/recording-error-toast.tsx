"use client";

import { helpPathById } from "@/app/(static)/help/_content/path-by-id";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/ui/toast";

import { useRecording } from "@/components/transcription/recording-provider";
import { openSitePage } from "@/lib/desktop/open-site-page";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";

const RECORDING_ERROR_TOAST_ID = "recording-error";

export function RecordingErrorToast() {
  const { error } = useRecording();
  const router = useRouter();
  const isDesktopApp = useDesktopApp();

  useEffect(() => {
    if (!error) {
      // 복구되면 손으로 닫지 않아도 사라진다.
      toast.dismiss(RECORDING_ERROR_TOAST_ID);
      return;
    }

    // **자동으로 닫지 않는다.** 독에는 되돌릴 수단(다시 시도)만 남기고 사유는 여기로 모았으므로,
    // 이 토스트가 닫히면 사용자가 무엇을 고쳐야 하는지 알 길이 사라진다(마이크 권한 등).
    toast.error(error, {
      id: RECORDING_ERROR_TOAST_ID,
      duration: Infinity,
      // 권한 거부처럼 브라우저 설정을 바꿔야 풀리는 사유가 많다. 어디를 고치는지는 도움말에 있다.
      action: {
        label: "해결 방법",
        onClick: () =>
          openSitePage(
            isDesktopApp
              ? `${helpPathById("desktop")}#first-run`
              : helpPathById("troubleshooting"),
            router.push
          ),
      },
    });
  }, [error, router, isDesktopApp]);

  return null;
}
