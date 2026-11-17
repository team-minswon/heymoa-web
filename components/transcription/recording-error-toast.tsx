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
      toast.dismiss(RECORDING_ERROR_TOAST_ID);
      return;
    }

    toast.error(error, {
      id: RECORDING_ERROR_TOAST_ID,
      duration: Infinity,
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
