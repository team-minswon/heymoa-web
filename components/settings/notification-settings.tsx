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

/**
 * 설정 > 계정 > 알림 (PRO-67 I10 · APP-1341). 사용자 단위이고 모든 워크스페이스에 같이 적용된다.
 *
 * **정책은 서버가 정한다.** 어느 종류가 필수인지, 어느 채널을 보내는지, 기본값이 무엇인지는 응답(`required`·`provided`·
 * `enabled`)을 그대로 그린다 — web 에 기본값을 복사하면 서버 정책 표가 바뀔 때 갈라진다. 저장도 서버가 돌려준 설정으로
 * 캐시를 바꾼 뒤에 화면이 움직인다(낙관 갱신 없음). 실패 토스트는 전역 훅이 띄운다.
 *
 * 확인·경고 문구는 화면에 상시 두지 않고 켤 때 뜨는 확인 창에만 둔다(rule `ui-text-layout`).
 */
/**
 * 종류별 이름. **여기 없는 종류는 그리지 않는다** — 서버가 web 보다 먼저 새 종류를 내면 이름 없는 빈 행이 섰다(APP-1348).
 * 문자열 키인 이유도 같다: 계약 미러가 따라오기 전에 서버가 낸 종류(`ANALYSIS_READY`)를 이름으로 받는다.
 */
const TYPE_ORDER = [
  "WORKSPACE_INVITATION",
  "MEETING_PAUSED_REMINDER",
  "ANALYSIS_READY",
  // 서버는 이 종류를 따로 내지 않는다 — 일시정지된 회의 메일을 따른다.
  "MEETING_AUTO_ENDED",
  "INQUIRY_ANSWERED",
] as const;
type KnownType = (typeof TYPE_ORDER)[number];
const isKnownType = (type: string): type is KnownType =>
  (TYPE_ORDER as readonly string[]).includes(type);
/** 이름 아래 한 줄 설명이 있는 종류. 문구는 `settings.notifications.descriptions`. */
const DESCRIBED_TYPES = [
  "MEETING_PAUSED_REMINDER",
  "ANALYSIS_READY",
  "INQUIRY_ANSWERED",
] as const;
const isDescribedType = (
  type: string
): type is (typeof DESCRIBED_TYPES)[number] =>
  (DESCRIBED_TYPES as readonly string[]).includes(type);
/** 행 순서는 시안을 따른다(일시정지된 회의 → 검토할 결과 준비). 서버가 주는 순서와 다를 수 있다. */
const CHANNELS = [
  { channel: "WEB", key: "web" },
  { channel: "EMAIL", key: "email" },
] as const;

// 채널별로 따로 끈다(APP-1352). 서버 필드 이름은 그대로 — muteAll 이 인앱, muteEmail 이 메일이다.
type Mute = "muteAll" | "muteEmail";
const MUTES: readonly Mute[] = ["muteAll", "muteEmail"];

function Header() {
  const t = useTranslations("settings.notifications");
  return <SettingsHeader title={t("title")} description={t("description")} />;
}

/** 이름 옆 ? 도움말. 언제 무엇이 오는지 — 읽지 않아도 스위치는 쓸 수 있다. 문장마다 한 줄씩 끊는다. */
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

/**
 * 종류별 표의 틀(카드·머리줄). 실제와 skeleton 이 같이 쓴다 — 머리줄은 고정 문구라 skeleton 에서도 그대로 선다.
 */
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
                // 채널 칸은 고정 폭이고 머리글·스위치·「—」가 모두 칸 가운데에 선다(APP-1352). 위 「모두 끄기」 스위치도
                // 같은 폭의 칸 가운데라 메일 열과 같은 세로줄이다.
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
/** 알림 설정을 쓰는 요청의 표식 — 연타한 요청이 모두 끝났는지 센다. */
const SETTINGS_WRITE = ["notification-settings-write"];
const isSettingsWrite = (mutation: { options: { mutationKey?: unknown } }) =>
  JSON.stringify(mutation.options.mutationKey) ===
  JSON.stringify(SETTINGS_WRITE);

const CARD =
  "rounded-panel border border-[var(--el-hairline)] bg-white px-6 py-2";
const ROW = "flex min-h-14 items-center justify-between gap-4 py-3";
const TYPE_ROW = "border-t border-[var(--el-hairline)]";
const TYPE_NAME_CELL = "py-3 text-left font-normal";
/** 채널 열 하나의 폭. 머리글과 행이 같은 열을 쓰고 내용은 가운데다. */
const CHANNEL_COLUMN = "w-[72px] text-center";
const TYPE_CHANNEL_CELL = cn(CHANNEL_COLUMN, "py-3 align-middle");
/**
 * skeleton 이 세우는 종류 행 수. 운영이 내는 선택 종류는 둘이다(일시정지된 회의 · 검토할 결과 준비). 목(`NOTIFICATION_DEFAULTS`)은
 * 아직 하나라 e2e 는 행 수가 아니라 행 하나의 높이와 첫 행 위치를 비교한다.
 */
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
  /** 서버가 돌려준 설정이 곧 화면이다(되돌리기). */
  const apply = (next: { status: number }) => {
    if (next.status === 200) queryClient.setQueryData(key, next);
  };

  /**
   * 스위치는 **누르는 즉시** 바뀐다(APP-1349). 캐시를 먼저 고치고, 실패하면 누르기 전 값으로 되돌린다(토스트는 전역 훅).
   * 진행 중 조회를 취소해 늦게 온 옛 응답이 덮지 못하게 하고, 연타한 요청이 모두 끝난 뒤에 한 번만 서버 값으로 맞춘다 —
   * 응답 순서가 뒤집혀도 마지막으로 누른 값이 남는다.
   */
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
      // 이 요청이 마지막이면(자기 자신만 남았으면) 서버 값으로 맞춘다.
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
  // 광고 수신 동의(APP-1392). 같은 응답을 돌려받으므로 다른 스위치와 같은 낙관 갱신·되돌림을 탄다.
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
  // 되돌리기는 확인 창 안에서 응답을 기다린다 — 무엇으로 돌아가는지는 서버만 안다.
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
            // 「모두 끄기」를 켜면 받는 것이 꺼진다.
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
            {/* 표의 채널 칸과 같은 폭의 칸 가운데 — 아래 메일 열 스위치와 같은 세로줄에 선다. */}
            <span
              className={cn(CHANNEL_COLUMN, "flex shrink-0 justify-center")}
            >
              <Switch
                aria-label={t(`mute.${key}.label`)}
                checked={settings[key]}
                disabled={busy}
                // 켤 때만 확인 창을 거친다. 풀 때는 바로 푼다.
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

      {/* 되돌리기 아래에 따로 둔다 — 법적 동의라 되돌리기가 건드리지 않는다(APP-1392). */}
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
                  // 확인을 누른 순간 반영하고 창을 닫는다.
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
  /** 「모두 끄기」가 가렸다. 값은 서버가 보존하고 풀면 돌아온다. */
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
    // 「모두 끄기」가 가린 칸. 스위치와 같은 자리·크기에 「꺼짐」만 둔다 — 옆에 글을 덧붙이면 칸 가운데가 어긋난다.
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

/**
 * 광고성 정보 수신 동의(APP-1392). 서비스 알림 표와 섞지 않는 별도 묶음이고 기본 꺼짐이다. 「메일 모두 끄기」와는 따로
 * 저장하지만, 켜져 있으면 이 메일도 가지 않는다고 알린다. 서버가 아직 필드를 내지 않으면 묶음째 숨긴다.
 */
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
      {/* 종류 이름은 응답의 종류로 정해져 막대로 둔다. 행은 이름 줄(20) + 설명 줄(2 + 16)이다. 빈 머리 칸이 표로 읽히지
          않게 보조기술에는 숨긴다. */}
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
