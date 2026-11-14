"use client";

import { helpPathById } from "@/app/[lang]/help/_content/path-by-id";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "@/lib/ui/toast";

import { useRecording } from "@/components/transcription/recording-provider";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import { billingEvents } from "@/lib/billing/analytics";
import { pushSettings } from "@/lib/workspace/settings-url";
import { openSitePage } from "@/lib/desktop/open-site-page";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";
import { localePath } from "@/lib/i18n/locales";

const RECORDING_ERROR_TOAST_ID = "recording-error";

export function RecordingErrorToast() {
  const { quotaExceeded } = useRecording();
  return quotaExceeded ? <QuotaExceededToast /> : <FailureToast />;
}

/**
 * 무료 월 한도로 녹음 시작이 거절됐다(409 `RECORDING_QUOTA_EXCEEDED`). 막힌 것은 **새 시작뿐**이고 진행 중인 회의는 끊기지
 * 않는다. ADMIN 은 요금제 화면으로 가는 액션을, 멤버는 관리자에게 요청하라는 안내를 받는다. 역할을 알아야 그릴 수 있어
 * 공간 조회가 끝나길 기다린다(실패하면 멤버 안내로 그린다).
 */
function QuotaExceededToast() {
  const t = useTranslations("recording.errorToast");
  const { error, activeWorkspaceId: workspaceId } = useRecording();
  const workspace = useGetWorkspace(workspaceId ?? "", {
    query: { enabled: Boolean(workspaceId) },
  });
  const settled = workspace.isSuccess || workspace.isError;
  const isAdmin = okData(workspace.data)?.role === "ADMIN";
  const reported = useRef(false);

  useEffect(() => {
    if (!error || !workspaceId || !settled) return;
    if (!reported.current) {
      reported.current = true;
      billingEvents.quotaBlocked(workspaceId, isAdmin ? "admin" : "member");
    }
    toast.error(error, {
      id: RECORDING_ERROR_TOAST_ID,
      duration: Infinity,
      ...(isAdmin
        ? {
            action: {
              label: t("quotaUpgrade"),
              onClick: () => {
                billingEvents.quotaUpgradeClicked(workspaceId);
                pushSettings("billing");
              },
            },
          }
        : { description: t("quotaAskAdmin") }),
    });
  }, [error, workspaceId, settled, isAdmin, t]);

  return null;
}

function FailureToast() {
  const t = useTranslations("recording.errorToast");
  const locale = useLocale();
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
        label: t("help"),
        onClick: () =>
          openSitePage(
            localePath(
              locale,
              isDesktopApp
                ? `${helpPathById("desktop")}#first-run`
                : helpPathById("troubleshooting")
            ),
            router.push
          ),
      },
    });
  }, [error, router, isDesktopApp, t, locale]);

  return null;
}
