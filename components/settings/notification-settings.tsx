"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/ui/help-tip";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { track } from "@/lib/analytics/track";
import type {
  NotificationSettingsResponseData,
  NotificationSettingsResponseDataItemsItemChannelsItem as ChannelSetting,
  NotificationSettingsResponseDataMarketingEmail as MarketingEmail,
} from "@/lib/api/generated/models";
import {
  getGetNotificationSettingsQueryKey,
  useGetNotificationSettingsSuspense,
  useResetNotificationSettings,
  useUpdateMarketingConsent,
  useUpdateNotificationMutes,
  useUpdateNotificationPreference,
} from "@/lib/api/generated/notification-settings/notification-settings";
import { cn } from "@/lib/utils";
import {
  SettingsHeader,
  SkeletonLine,
} from "@/components/settings/settings-layout";

const TYPE_ORDER = [
  "WORKSPACE_INVITATION",
  "MEETING_PAUSED_REMINDER",
  "ANALYSIS_READY",
  "MEETING_AUTO_ENDED",
  "INQUIRY_ANSWERED",
] as const;
type KnownType = (typeof TYPE_ORDER)[number];
const isKnownType = (type: string): type is KnownType =>
  (TYPE_ORDER as readonly string[]).includes(type);
const DESCRIBED_TYPES = [
  "MEETING_PAUSED_REMINDER",
  "ANALYSIS_READY",
  "INQUIRY_ANSWERED",
] as const;
const isDescribedType = (
  type: string
): type is (typeof DESCRIBED_TYPES)[number] =>
  (DESCRIBED_TYPES as readonly string[]).includes(type);
const CHANNELS = [
  { channel: "WEB", key: "web" },
  { channel: "EMAIL", key: "email" },
] as const;

type Mute = "muteAll" | "muteEmail";
const MUTES: readonly Mute[] = ["muteAll", "muteEmail"];

function Header() {
  const t = useTranslations("settings.notifications");
  return <SettingsHeader title={t("title")} description={t("description")} />;
}

function TypeHelp({ type }: { type: KnownType }) {
  const t = useTranslations("settings.notifications");
  if (type !== "MEETING_PAUSED_REMINDER") return null;
  return (
    <HelpTip label={t("helpLabel", { type: t(`types.${type}`) })}>
      <span className="block">{t("help.pausedReminder")}</span>
      <span className="mt-1 block">{t("help.pausedAutoEnd")}</span>
    </HelpTip>
  );
}

function TypeTable({ children }: { children: React.ReactNode }) {
  const t = useTranslations("settings.notifications");
  return (
    <div className={CARD}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-[var(--el-muted)]">
            <th scope="col" className="py-3 text-left font-normal">
              {t("typeColumn")}
            </th>
            {CHANNELS.map(({ channel, key }) => (
              <th
                key={channel}
                scope="col"
                className={cn(CHANNEL_COLUMN, "py-3 font-normal")}
              >
                {t(`channels.${key}.label`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

type Settings = NotificationSettingsResponseData;
const SETTINGS_WRITE = ["notification-settings-write"];
const isSettingsWrite = (mutation: { options: { mutationKey?: unknown } }) =>
  JSON.stringify(mutation.options.mutationKey) ===
  JSON.stringify(SETTINGS_WRITE);

const CARD =
  "rounded-panel border border-[var(--el-hairline)] bg-white px-6 py-2";
const ROW = "flex min-h-14 items-center justify-between gap-4 py-3";
const TYPE_ROW = "border-t border-[var(--el-hairline)]";
const TYPE_NAME_CELL = "py-3 text-left font-normal";
const CHANNEL_COLUMN = "w-[72px] text-center";
const TYPE_CHANNEL_CELL = cn(CHANNEL_COLUMN, "py-3 align-middle");
const SKELETON_TYPE_ROWS = 2;

export function NotificationSettings({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations("settings.notifications");
  const tActions = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const response = useGetNotificationSettingsSuspense().data;
  if (response.status !== 200 || !response.data.success) {
    throw new Error(t("loadFailed"));
  }
  const settings: Settings = response.data.data;
  const [confirm, setConfirm] = useState<Mute | "reset" | null>(null);

  const key = getGetNotificationSettingsQueryKey();
  const apply = (next: { status: number }) => {
    if (next.status === 200) queryClient.setQueryData(key, next);
  };

  const optimistic = <V,>(
    change: (current: Settings, variables: V) => Settings
  ) => ({
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<typeof response>(key);
      queryClient.setQueryData<typeof response>(key, (cached) =>
        cached?.status === 200 && cached.data.success
          ? {
              ...cached,
              data: {
                ...cached.data,
                data: change(cached.data.data, variables),
              },
            }
          : cached
      );
      return { previous };
    },
    onError: (
      _error: unknown,
      _variables: V,
      context: { previous?: typeof response } | undefined
    ) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      if (queryClient.isMutating({ predicate: isSettingsWrite }) <= 1)
        void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const mutes = useUpdateNotificationMutes({
    mutation: {
      mutationKey: SETTINGS_WRITE,
      ...optimistic<{ data?: { muteAll: boolean; muteEmail: boolean } }>(
        (current, { data }) => ({ ...current, ...data })
      ),
    },
  });
  const preference = useUpdateNotificationPreference({
    mutation: {
      mutationKey: SETTINGS_WRITE,
      ...optimistic<{
        data?: { type: string; channel: string; enabled: boolean };
      }>((current, { data }) =>
        !data
          ? current
          : {
              ...current,
              items: current.items.map((item) =>
                item.type === data.type
                  ? {
                      ...item,
                      channels: item.channels.map((entry) =>
                        entry.channel === data.channel
                          ? { ...entry, enabled: data.enabled }
                          : entry
                      ),
                    }
                  : item
              ),
            }
      ),
    },
  });
  const marketing = useUpdateMarketingConsent({
    mutation: {
      mutationKey: SETTINGS_WRITE,
      ...optimistic<{ data?: { agreed: boolean } }>((current, { data }) =>
        data
          ? {
              ...current,
              marketingEmail: {
                agreed: data.agreed,
                changedAt: new Date().toISOString(),
              },
            }
          : current
      ),
    },
  });
  const reset = useResetNotificationSettings({
    mutation: { onSuccess: apply },
  });
  const busy = reset.isPending;

  const setMute = (key: Mute, on: boolean) =>
    mutes.mutate(
      {
        data: {
          muteAll: settings.muteAll,
          muteEmail: settings.muteEmail,
          [key]: on,
        },
      },
      {
        onSuccess: () =>
          track("notification_setting_changed", {
            workspace_id: workspaceId,
            scope: key === "muteAll" ? "all" : "email",
            enabled: !on,
          }),
      }
    );

  const optional = settings.items
    .flatMap((item) =>
      !item.required && isKnownType(item.type)
        ? [{ ...item, type: item.type }]
        : []
    )
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));

  return (
    <div
      className="mx-auto w-full max-w-[720px] space-y-8"
      aria-label={t("label")}
    >
      <Header />

      <section aria-label={t("muteSection")} className={CARD}>
        {MUTES.map((key, index) => (
          <div
            key={key}
            className={cn(
              ROW,
              index > 0 && "border-t border-[var(--el-hairline)]"
            )}
          >
            <span className="text-sm font-medium text-[var(--el-ink)]">
              {t(`mute.${key}.label`)}
            </span>
            <span
              className={cn(CHANNEL_COLUMN, "flex shrink-0 justify-center")}
            >
              <Switch
                aria-label={t(`mute.${key}.label`)}
                checked={settings[key]}
                disabled={busy}
                onCheckedChange={(on) =>
                  on ? setConfirm(key) : setMute(key, false)
                }
              />
            </span>
          </div>
        ))}
      </section>

      <section aria-label={t("typeSection")}>
        <TypeTable>
          {optional.map((item) => (
            <tr key={item.type} className={TYPE_ROW}>
              <th scope="row" className={TYPE_NAME_CELL}>
                <span className="flex items-center gap-1 font-medium text-[var(--el-ink)]">
                  {t(`types.${item.type}`)}
                  <TypeHelp type={item.type} />
                </span>
                {isDescribedType(item.type) ? (
                  <span className="mt-0.5 block text-xs text-[var(--el-muted)]">
                    {t(`descriptions.${item.type}`)}
                  </span>
                ) : null}
              </th>
              {CHANNELS.map(({ channel, key: channelKey }) => {
                const value = item.channels.find(
                  (entry) => entry.channel === channel
                );
                return (
                  <td key={channel} className={TYPE_CHANNEL_CELL}>
                    <ChannelCell
                      value={value}
                      label={t("channelLabel", {
                        type: t(`types.${item.type}`),
                        channel: t(`channels.${channelKey}.label`),
                      })}
                      missing={t(`channels.${channelKey}.missing`)}
                      muted={
                        channel === "WEB"
                          ? settings.muteAll
                          : settings.muteEmail
                      }
                      disabled={busy}
                      onChange={(enabled) =>
                        preference.mutate(
                          { data: { type: item.type, channel, enabled } },
                          {
                            onSuccess: () =>
                              track("notification_setting_changed", {
                                workspace_id: workspaceId,
                                scope: "type",
                                type: item.type,
                                channel,
                                enabled,
                              }),
                          }
                        )
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </TypeTable>
      </section>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setConfirm("reset")}
        >
          {t("reset.button")}
        </Button>
      </div>

      <MarketingConsentCard
        value={settings.marketingEmail}
        muteEmail={settings.muteEmail}
        onChange={(agreed) => marketing.mutate({ data: { agreed } })}
      />

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (busy) return;
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "reset"
                ? t("reset.title")
                : confirm
                  ? t(`mute.${confirm}.title`)
                  : null}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "reset"
                ? t("reset.body")
                : confirm
                  ? t(`mute.${confirm}.body`)
                  : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {tActions("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              loading={busy}
              disabled={busy}
              onClick={() => {
                if (confirm === "reset")
                  reset.mutate(undefined, {
                    onSuccess: () => {
                      track("notification_settings_reset", {
                        workspace_id: workspaceId,
                      });
                      setConfirm(null);
                    },
                  });
                else if (confirm) {
                  setMute(confirm, true);
                  setConfirm(null);
                }
              }}
            >
              {confirm === "reset" ? t("reset.confirm") : t("muteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChannelCell({
  value,
  label,
  missing,
  muted,
  disabled,
  onChange,
}: {
  value: ChannelSetting | undefined;
  label: string;
  missing: string;
  muted: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const t = useTranslations("settings.notifications");
  if (!value?.provided) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              aria-label={missing}
              className="inline-flex h-5 w-9 items-center justify-center text-[var(--el-muted)]"
            />
          }
        >
          —
        </TooltipTrigger>
        <TooltipContent>{missing}</TooltipContent>
      </Tooltip>
    );
  }
  if (muted) {
    return (
      <span
        aria-label={t("offLabel", { label })}
        className="inline-flex h-5 w-9 items-center justify-center text-xs whitespace-nowrap text-[var(--el-muted)]"
      >
        {t("off")}
      </span>
    );
  }
  return (
    <Switch
      aria-label={label}
      checked={value.enabled}
      disabled={disabled}
      onCheckedChange={onChange}
    />
  );
}

function MarketingConsentCard({
  value,
  muteEmail,
  onChange,
}: {
  value: MarketingEmail;
  muteEmail: boolean;
  onChange: (agreed: boolean) => void;
}) {
  const t = useTranslations("common.marketingConsent");
  const format = useFormatter();
  const date = value.changedAt
    ? format.dateTime(new Date(value.changedAt), {
        month: "long",
        day: "numeric",
        timeZone: "Asia/Seoul",
      })
    : null;

  return (
    <section aria-label={t("title")}>
      <h3 className="mb-2 text-xs text-[var(--el-muted)]">{t("title")}</h3>
      <div className={CARD}>
        <div className={ROW}>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[var(--el-ink)]">
              {t("label")}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--el-muted)]">
              {t("description")}
            </span>
            {muteEmail ? (
              <span className="mt-0.5 block text-xs text-[var(--el-muted)]">
                {t("mutedNote")}
              </span>
            ) : null}
            {date ? (
              <span className="mt-0.5 block text-xs text-[var(--el-muted)]">
                {t(value.agreed ? "agreedOn" : "declinedOn", { date })}
              </span>
            ) : null}
          </span>
          <span className={cn(CHANNEL_COLUMN, "flex shrink-0 justify-center")}>
            <Switch
              aria-label={t("label")}
              checked={value.agreed}
              onCheckedChange={onChange}
            />
          </span>
        </div>
      </div>
    </section>
  );
}

export function NotificationSettingsSkeleton() {
  const t = useTranslations("settings.notifications");
  return (
    <div
      className="mx-auto w-full max-w-[720px] space-y-8"
      aria-label={t("loading")}
    >
      <Header />
      <section className={CARD}>
        {MUTES.map((key, index) => (
          <div
            key={key}
            className={cn(
              ROW,
              index > 0 && "border-t border-[var(--el-hairline)]"
            )}
          >
            <span className="text-sm font-medium text-[var(--el-ink)]">
              {t(`mute.${key}.label`)}
            </span>
            <span
              className={cn(CHANNEL_COLUMN, "flex shrink-0 justify-center")}
            >
              <Skeleton className="h-5 w-9 rounded-full" />
            </span>
          </div>
        ))}
      </section>
      <section aria-hidden>
        <TypeTable>
          {Array.from({ length: SKELETON_TYPE_ROWS }, (_, index) => (
            <tr key={index} className={TYPE_ROW}>
              <th scope="row" className={TYPE_NAME_CELL}>
                <SkeletonLine className="w-28" />
                <span className="mt-0.5 block">
                  <SkeletonLine size="xs" className="w-44" />
                </span>
              </th>
              {CHANNELS.map(({ channel }) => (
                <td key={channel} className={TYPE_CHANNEL_CELL}>
                  <Skeleton className="mx-auto h-5 w-9 rounded-full" />
                </td>
              ))}
            </tr>
          ))}
        </TypeTable>
      </section>
      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled>
          {t("reset.button")}
        </Button>
      </div>
    </div>
  );
}
