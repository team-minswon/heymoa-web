"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { track } from "@/lib/analytics/track";
import type {
  NotificationSettingsResponseDataItemsItemChannelsItem as ChannelSetting,
  NotificationSettingsResponseDataItemsItemType as NotificationType,
} from "@/lib/api/generated/models";
import {
  getGetNotificationSettingsQueryKey,
  useGetNotificationSettingsSuspense,
  useResetNotificationSettings,
  useUpdateNotificationMutes,
  useUpdateNotificationPreference,
} from "@/lib/api/generated/notification-settings/notification-settings";
import { useGetCurrentUserSuspense } from "@/lib/api/generated/users/users";
import { cn } from "@/lib/utils";

/**
 * 설정 > 계정 > 알림 (PRO-67 I10 · APP-1341). 사용자 단위이고 모든 워크스페이스에 같이 적용된다.
 *
 * **정책은 서버가 정한다.** 어느 종류가 필수인지, 어느 채널을 보내는지, 기본값이 무엇인지는 응답(`required`·`provided`·
 * `enabled`)을 그대로 그린다 — web 에 기본값을 복사하면 서버 정책 표가 바뀔 때 갈라진다. 저장도 서버가 돌려준 설정으로
 * 캐시를 바꾼 뒤에 화면이 움직인다(낙관 갱신 없음). 실패 토스트는 전역 훅이 띄운다.
 *
 * 확인·경고 문구는 화면에 상시 두지 않고 켤 때 뜨는 확인 창에만 둔다(rule `ui-text-layout`).
 */
const TYPE_LABELS: Record<NotificationType, string> = {
  WORKSPACE_INVITATION: "워크스페이스 초대",
  MEETING_PAUSED_REMINDER: "중지된 회의",
  // 서버는 이 종류를 따로 내지 않는다 — 중지된 회의 메일을 따른다.
  MEETING_AUTO_ENDED: "회의 자동 종료",
};
const TYPE_DESCRIPTIONS: Partial<Record<NotificationType, string>> = {
  MEETING_PAUSED_REMINDER: "리마인더와 자동 종료 안내",
};
const CHANNELS = [
  { channel: "WEB", label: "웹", missing: "이 알림은 웹으로 보내지 않습니다" },
  {
    channel: "EMAIL",
    label: "메일",
    missing: "이 알림은 메일로 보내지 않습니다",
  },
] as const;

type Mute = "muteAll" | "muteEmail";
const MUTE_CONFIRM: Record<Mute, { title: string; body: string }> = {
  muteAll: {
    title: "알림을 모두 끌까요?",
    body: "중지된 회의 메일과 검토할 결과 알림을 모두 받지 않습니다. 다시 켜면 이전 설정이 그대로 돌아옵니다.",
  },
  muteEmail: {
    title: "메일을 모두 끌까요?",
    body: "선택 메일을 받지 않습니다. 웹 알림은 그대로입니다. 다시 켜면 이전 설정이 그대로 돌아옵니다.",
  },
};

function Header() {
  return (
    <div>
      <h2 className="text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
        알림
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--el-muted)]">
        받을 알림을 고릅니다. 모든 워크스페이스에 같이 적용됩니다.
      </p>
    </div>
  );
}

const CARD =
  "rounded-panel border border-[var(--el-hairline)] bg-white px-6 py-2";
const ROW = "flex min-h-14 items-center justify-between gap-4 py-3";

export function NotificationSettings({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const response = useGetNotificationSettingsSuspense().data;
  const userResponse = useGetCurrentUserSuspense().data;
  if (response.status !== 200 || !response.data.success) {
    throw new Error("알림 설정을 불러오지 못했습니다.");
  }
  const settings = response.data.data;
  const email =
    userResponse.status === 200 && userResponse.data.success
      ? userResponse.data.data.email
      : "";
  const [confirm, setConfirm] = useState<Mute | "reset" | null>(null);

  /** 서버가 돌려준 설정이 곧 화면이다. */
  const apply = (next: { status: number }) => {
    if (next.status === 200)
      queryClient.setQueryData(getGetNotificationSettingsQueryKey(), next);
  };

  const mutes = useUpdateNotificationMutes({ mutation: { onSuccess: apply } });
  const preference = useUpdateNotificationPreference({
    mutation: { onSuccess: apply },
  });
  const reset = useResetNotificationSettings({
    mutation: { onSuccess: apply },
  });
  const busy = mutes.isPending || preference.isPending || reset.isPending;

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
        onSuccess: () => {
          track("notification_setting_changed", {
            workspace_id: workspaceId,
            scope: key === "muteAll" ? "all" : "email",
            // 「모두 끄기」를 켜면 받는 것이 꺼진다.
            enabled: !on,
          });
          setConfirm(null);
        },
      }
    );

  const optional = settings.items.filter((item) => !item.required);

  return (
    <div className="mx-auto max-w-2xl space-y-8" aria-label="알림 설정">
      <Header />

      <section aria-label="전체 끄기" className={CARD}>
        {(
          [
            ["muteAll", "알림 모두 끄기"],
            ["muteEmail", "메일 모두 끄기"],
          ] as const
        ).map(([key, label], index) => (
          <div
            key={key}
            className={cn(
              ROW,
              index > 0 && "border-t border-[var(--el-hairline)]"
            )}
          >
            <span className="text-sm font-medium text-[var(--el-ink)]">
              {label}
            </span>
            <Switch
              aria-label={label}
              checked={settings[key]}
              disabled={busy}
              // 켤 때만 확인 창을 거친다. 풀 때는 바로 푼다.
              onCheckedChange={(on) =>
                on ? setConfirm(key) : setMute(key, false)
              }
            />
          </div>
        ))}
      </section>

      <section aria-label="종류별 알림">
        <div className={CARD}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--el-muted)]">
                <th scope="col" className="py-3 text-left font-normal">
                  종류
                </th>
                {CHANNELS.map(({ channel, label }) => (
                  <th
                    key={channel}
                    scope="col"
                    // 스위치는 칸 오른쪽에 붙인다 — 위 「모두 끄기」 스위치와 오른쪽 끝이 같은 세로줄에 선다.
                    className="w-20 py-3 text-right font-normal"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {optional.map((item) => (
                <tr
                  key={item.type}
                  className="border-t border-[var(--el-hairline)]"
                >
                  <th scope="row" className="py-3 text-left font-normal">
                    <span className="block font-medium text-[var(--el-ink)]">
                      {TYPE_LABELS[item.type]}
                    </span>
                    {TYPE_DESCRIPTIONS[item.type] ? (
                      <span className="mt-0.5 block text-xs text-[var(--el-muted)]">
                        {TYPE_DESCRIPTIONS[item.type]}
                      </span>
                    ) : null}
                  </th>
                  {CHANNELS.map(({ channel, label, missing }) => {
                    const value = item.channels.find(
                      (entry) => entry.channel === channel
                    );
                    return (
                      <td key={channel} className="py-3 text-right">
                        <ChannelCell
                          value={value}
                          label={`${TYPE_LABELS[item.type]} ${label}`}
                          missing={missing}
                          muted={
                            settings.muteAll ||
                            (channel === "EMAIL" && settings.muteEmail)
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
            </tbody>
          </table>
        </div>
        <p className="mt-3 px-1 text-xs text-[var(--el-muted)]">
          워크스페이스 초대 같은 필수 알림은 여기서 끌 수 없습니다.
        </p>
      </section>

      <section
        aria-label="메일 받는 주소"
        className="space-y-2 rounded-panel border border-[var(--el-hairline)] bg-white p-6"
      >
        <Label htmlFor="notification-email">메일 받는 주소</Label>
        <Input id="notification-email" value={email} disabled />
      </section>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setConfirm("reset")}
        >
          기본값으로 되돌리기
        </Button>
      </div>

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
                ? "알림 설정을 기본값으로 되돌릴까요?"
                : confirm
                  ? MUTE_CONFIRM[confirm].title
                  : null}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "reset"
                ? "중지된 회의 메일과 검토할 결과 웹 알림이 다시 켜집니다."
                : confirm
                  ? MUTE_CONFIRM[confirm].body
                  : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
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
                else if (confirm) setMute(confirm, true);
              }}
            >
              {confirm === "reset" ? "되돌리기" : "끄기"}
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
      <span className="inline-flex items-center gap-1.5 opacity-50">
        <Switch aria-label={label} checked={false} disabled />
        <span className="whitespace-nowrap text-xs text-[var(--el-muted)]">
          꺼짐
        </span>
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

export function NotificationSettingsSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-8"
      aria-label="알림 설정 불러오는 중"
    >
      <Header />
      <section className={CARD}>
        {["알림 모두 끄기", "메일 모두 끄기"].map((label, index) => (
          <div
            key={label}
            className={cn(
              ROW,
              index > 0 && "border-t border-[var(--el-hairline)]"
            )}
          >
            <span className="text-sm font-medium text-[var(--el-ink)]">
              {label}
            </span>
            <Skeleton className="h-5 w-9 rounded-full" />
          </div>
        ))}
      </section>
      <section>
        <Skeleton className="h-[110px] rounded-panel" />
        <p className="mt-3 px-1 text-xs text-[var(--el-muted)]">
          워크스페이스 초대 같은 필수 알림은 여기서 끌 수 없습니다.
        </p>
      </section>
      <Skeleton className="h-[106px] rounded-panel" />
      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled>
          기본값으로 되돌리기
        </Button>
      </div>
    </div>
  );
}
