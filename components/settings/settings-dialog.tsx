"use client";

import { track } from "@/lib/analytics/track";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SETTINGS_SECTION,
  type SettingsSection,
} from "@/lib/workspace/settings-url";
import {
  useGetMyBillingPayments,
  useGetWorkspaceBilling,
} from "@/lib/api/generated/billing/billing";
import { useGetWorkspace } from "@/lib/api/generated/workspaces/workspaces";
import { okData } from "@/lib/api/ok-data";
import {
  BellRing,
  Download,
  BookA,
  Bot,
  CreditCard,
  Gem,
  Languages,
  Plug,
  Receipt,
  Settings,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import {
  AccountSettingsForm,
  AccountSettingsFormSkeleton,
} from "@/components/settings/account-settings-form";
import { AgentConnectionsSettings } from "@/components/settings/agent-connections-settings";
import { GuestsSettings } from "@/components/settings/guests-settings";
import { DesktopUpdateSettings } from "@/components/settings/desktop-update-settings";
import { useDesktopApp } from "@/lib/desktop/use-desktop-app";
import { desktopUpdateBridge } from "@/lib/desktop/updates";
import { toast } from "@/lib/ui/toast";
import { LanguageSettings } from "@/components/settings/language-settings";
import { MembersSettings } from "@/components/settings/members-settings";
import {
  NotificationSettings,
  NotificationSettingsSkeleton,
} from "@/components/settings/notification-settings";
import { MyPaymentsSettings } from "@/components/billing/my-payments-settings";
import { WorkspacePaymentSettings } from "@/components/billing/payment-settings";
import { WorkspacePlanSettings } from "@/components/billing/plan-settings";
import { WorkspaceTermsSettings } from "@/components/terms/workspace-terms-settings";
import { WorkspaceAgentAccessSettings } from "@/components/settings/workspace-agent-access-settings";
import { WorkspaceIntegrationsSettings } from "@/components/settings/workspace-integrations-settings";
import {
  WorkspaceSettingsForm,
  WorkspaceSettingsFormSkeleton,
} from "@/components/settings/workspace-settings-form";
import { DataBoundary } from "@/components/ui/data-boundary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type { SettingsSection };

const SETTINGS_GROUPS: {
  key: "workspace" | "account";
  items: {
    key: SettingsSection;
    Icon: typeof Settings;
  }[];
}[] = [
  {
    key: "workspace",
    items: [
      { key: "workspace", Icon: Settings },
      { key: "members", Icon: UsersRound },
      { key: "guests", Icon: UserRoundPlus },
      { key: "terms", Icon: BookA },
      { key: "integrations", Icon: Plug },
      { key: "workspaceAgents", Icon: ShieldCheck },
      { key: "billing", Icon: Gem },
      { key: "payment", Icon: CreditCard },
    ],
  },
  {
    key: "account",
    items: [
      { key: "account", Icon: UserRound },
      { key: "myPayments", Icon: Receipt },
      { key: "language", Icon: Languages },
      { key: "notifications", Icon: BellRing },
      { key: "agents", Icon: Bot },
      { key: "appUpdates", Icon: Download },
    ],
  },
];

import {
  hasDesktopUpdate,
  useDesktopUpdates,
} from "@/lib/desktop/use-desktop-updates";

const LANGUAGE_LABEL = "언어 · Language";

function SettingsSections({
  section,
  onSectionChange,
  workspaceId,
  locked,
  onLockChange,
  enforced,
  admin,
  hasPayments,
}: {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  workspaceId: string;
  enforced: boolean;
  admin: boolean;
  hasPayments: boolean;
  locked: boolean;
  onLockChange: (locked: boolean) => void;
}) {
  const t = useTranslations("settings.nav");
  const desktop = useDesktopApp();
  const update = useDesktopUpdates();
  const billingSection = section === "billing" || section === "payment";
  return (
    <div className="grid h-full min-h-0 bg-[var(--el-canvas-soft)] md:grid-cols-[220px_1fr]">
      <nav
        aria-label={t("title")}
        className="min-h-0 overflow-y-auto border-b border-[var(--el-hairline)] bg-[var(--el-canvas)] p-4 md:border-r md:border-b-0 md:p-6"
      >
        <p className="mb-7 text-3xl font-light tracking-[-0.03em]">
          {t("title")}
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-1">
          {SETTINGS_GROUPS.map((group) => (
            <div
              key={group.key}
              role="group"
              aria-label={t(`groups.${group.key}`)}
              className="grid content-start gap-1"
            >
              <p
                aria-hidden
                className="px-3 pb-1 text-xs text-[var(--el-muted)]"
              >
                {t(`groups.${group.key}`)}
              </p>
              {group.items
                .filter(
                  ({ key }) =>
                    key !== "appUpdates" ||
                    (desktop === true &&
                      !desktopUpdateBridge()?.openPreferences)
                )
                .filter(
                  ({ key }) =>
                    (key !== "billing" && key !== "payment") ||
                    (enforced && (key === "billing" || admin))
                )
                .filter(({ key }) => key !== "myPayments" || hasPayments)
                .map(({ key, Icon }) => (
                  <Button
                    key={key}
                    type="button"
                    variant="ghost"
                    disabled={locked && section !== key}
                    onClick={() => {
                      if (section === key) return;
                      track("settings_tab_opened", {
                        workspace_id: workspaceId,
                        section: key,
                        from: "settings",
                      });
                      onSectionChange(key);
                    }}
                    aria-current={section === key ? "page" : undefined}
                    className={cn(
                      "h-10 justify-start gap-2.5 rounded-block px-3",
                      section === key
                        ? "bg-[var(--el-hairline)] font-medium hover:bg-[var(--el-hairline)]"
                        : "hover:bg-[var(--el-surface-strong)]"
                    )}
                  >
                    <Icon
                      className="size-4 text-[var(--el-muted)]"
                      aria-hidden
                    />
                    {key === "language" ? LANGUAGE_LABEL : t(`items.${key}`)}
                    {key === "appUpdates" && hasDesktopUpdate(update) ? (
                      <span
                        aria-label={t("items.appUpdates")}
                        className="ml-auto size-2 rounded-full bg-[var(--el-ink)]"
                      />
                    ) : null}
                  </Button>
                ))}
            </div>
          ))}
        </div>
      </nav>
      {/* **탭을 오가도 본문 폭이 같아야 한다.** 긴 탭에만 스크롤바(클래식 15px)가 생기면 그만큼 본문이
          좁아져 머리글이 옆으로 움직였다 — 자리를 늘 잡아 둔다. */}
      <div
        data-testid="settings-panel"
        className="min-h-0 overflow-y-auto bg-white/60 p-6 pt-14 [scrollbar-gutter:stable] sm:p-10 md:p-14"
      >
        {section === "account" ? (
          <DataBoundary
            fallback={<AccountSettingsFormSkeleton />}
            errorLabel={t("loadFailed.account")}
            resetKeys={["account"]}
          >
            <AccountSettingsForm />
          </DataBoundary>
        ) : section === "myPayments" ? (
          hasPayments ? (
            <MyPaymentsSettings />
          ) : null
        ) : section === "language" ? (
          <LanguageSettings />
        ) : section === "appUpdates" ? (
          <DesktopUpdateSettings />
        ) : section === "notifications" ? (
          <DataBoundary
            fallback={<NotificationSettingsSkeleton />}
            errorLabel={t("loadFailed.notifications")}
            resetKeys={["notifications"]}
          >
            <NotificationSettings workspaceId={workspaceId} />
          </DataBoundary>
        ) : section === "members" ? (
          <MembersSettings workspaceId={workspaceId} />
        ) : section === "guests" ? (
          <GuestsSettings workspaceId={workspaceId} />
        ) : section === "terms" ? (
          <WorkspaceTermsSettings workspaceId={workspaceId} />
        ) : section === "integrations" ? (
          <WorkspaceIntegrationsSettings workspaceId={workspaceId} />
        ) : section === "workspaceAgents" ? (
          <WorkspaceAgentAccessSettings workspaceId={workspaceId} />
        ) : billingSection && !enforced ? null : section === "billing" ||
          (section === "payment" && !admin) ? (
          <WorkspacePlanSettings
            workspaceId={workspaceId}
            onOpenPayment={() => onSectionChange("payment")}
          />
        ) : section === "payment" ? (
          <WorkspacePaymentSettings
            workspaceId={workspaceId}
            onOpenPlans={() => onSectionChange("billing")}
          />
        ) : section === "agents" ? (
          <AgentConnectionsSettings
            workspaceId={workspaceId}
            onBusyChange={onLockChange}
          />
        ) : (
          <DataBoundary
            fallback={<WorkspaceSettingsFormSkeleton />}
            errorLabel={t("loadFailed.workspace")}
            resetKeys={["workspace"]}
          >
            <WorkspaceSettingsForm workspaceId={workspaceId} />
          </DataBoundary>
        )}
      </div>
    </div>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  section,
  onSectionChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  workspaceId: string;
}) {
  const t = useTranslations("settings.nav");
  const tUpdate = useTranslations("settings.appUpdates");
  const desktop = useDesktopApp();
  const openNative =
    desktop === true ? desktopUpdateBridge()?.openPreferences : undefined;
  const nativeUpdate = open && section === "appUpdates" && Boolean(openNative);
  const requestedNative = useRef(false);
  useEffect(() => {
    if (!nativeUpdate) {
      requestedNative.current = false;
      return;
    }
    if (requestedNative.current) return;
    requestedNative.current = true;
    onOpenChange(false);
    toast.info(tUpdate("nativeSettingsNotice"), {
      id: "desktop-settings-route",
      action: {
        label: tUpdate("openNativeSettings"),
        onClick: () => {
          void (async () => {
            try {
              await openNative?.();
              toast.dismiss("desktop-settings-route");
            } catch {
              toast.error(tUpdate("failed"));
            }
          })();
        },
      },
    });
  }, [nativeUpdate, openNative, onOpenChange, tUpdate]);
  const [locked, setLocked] = useState(false);
  const billing = useGetWorkspaceBilling(workspaceId, {
    query: { enabled: open },
  });
  const enforced = okData(billing.data)?.enforced === true;
  const workspace = useGetWorkspace(workspaceId, { query: { enabled: open } });
  const myPayments = useGetMyBillingPayments({ query: { enabled: open } });
  const hasPayments = (okData(myPayments.data)?.payments.length ?? 0) > 0;
  const admin = okData(workspace.data)?.role === "ADMIN";
  useEffect(() => {
    if (
      open &&
      (section === "billing" || section === "payment") &&
      !billing.isPending &&
      !enforced
    )
      onSectionChange(DEFAULT_SETTINGS_SECTION);
    else if (open && section === "payment" && !workspace.isPending && !admin)
      onSectionChange("billing");
    else if (
      open &&
      section === "myPayments" &&
      !myPayments.isPending &&
      !hasPayments
    )
      onSectionChange("account");
  }, [
    myPayments.isPending,
    hasPayments,
    open,
    section,
    billing.isPending,
    enforced,
    workspace.isPending,
    admin,
    onSectionChange,
  ]);
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && locked) return;
      onOpenChange(next);
    },
    [locked, onOpenChange]
  );
  return (
    <Dialog open={open && !nativeUpdate} onOpenChange={handleOpenChange}>
      <DialogContent className="h-dvh max-h-none w-screen max-w-none gap-0 overflow-hidden rounded-none border border-black/5 bg-[var(--el-canvas)] p-0 shadow-e3 sm:h-[min(780px,calc(100dvh-3rem))] sm:max-w-5xl sm:rounded-panel">
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("description")}
        </DialogDescription>
        <SettingsSections
          section={section}
          onSectionChange={onSectionChange}
          workspaceId={workspaceId}
          locked={locked}
          onLockChange={setLocked}
          enforced={enforced}
          admin={admin}
          hasPayments={hasPayments}
        />
      </DialogContent>
    </Dialog>
  );
}
