"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  SettingsGap,
  SettingsRow,
  SettingsSection,
} from "@/components/settings/settings-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  getGetNotificationPreferencesQueryKey,
  useGetNotificationPreferencesSuspense,
  useUpdateNotificationPreferences,
} from "@/lib/api/generated/users/users";
import type { NotificationPreferences } from "@/lib/api/generated/models";

/**
 * 알림 설정. design.pen `ISO4Z` — 사건 6개가 「앱 안에서」와 「메일로」 두 묶음이다.
 *
 * 스위치는 **누르는 즉시 저장한다.** 저장 버튼을 따로 두면 사용자는 껐다고 믿고 나가는데
 * 실제로는 안 껐을 수 있다 — 이 화면에서 그건 원치 않는 알림을 계속 받는다는 뜻이다.
 */
type PreferenceKey = keyof NotificationPreferences;

const GROUPS: {
  label: string;
  note: string;
  items: { key: PreferenceKey; title: string; detail: string }[];
}[] = [
  {
    label: "앱 안에서",
    note: "종 아이콘에 쌓입니다",
    items: [
      {
        key: "meetingStarted",
        title: "회의가 시작되면",
        detail: "내가 참석자인 회의가 기록을 시작할 때",
      },
      {
        key: "analysisCompleted",
        title: "분석이 끝나면",
        detail: "회의록 정리가 완료되면",
      },
      {
        key: "analysisFailed",
        title: "분석이 실패하면",
        detail: "다시 분석할 수 있게 알립니다",
      },
      {
        key: "sharedChatMessage",
        title: "공유 챗에 새 메시지",
        detail: "내가 참석한 회의의 공유 챗",
      },
    ],
  },
  {
    label: "메일로",
    note: "로그인한 주소로 갑니다",
    items: [
      {
        key: "workspaceInvitation",
        title: "워크스페이스 초대",
        detail: "누군가 나를 초대했을 때",
      },
      {
        key: "weeklyDigest",
        title: "주간 요약",
        detail: "한 주 회의를 월요일 아침에 모아서",
      },
    ],
  },
];

export function NotificationsSettings() {
  const queryClient = useQueryClient();
  const response = useGetNotificationPreferencesSuspense().data;
  if (response.status !== 200 || !response.data.success) {
    throw new Error("알림 설정을 불러오지 못했습니다.");
  }
  const preferences = response.data.data;

  const update = useUpdateNotificationPreferences({
    mutation: {
      meta: { suppressErrorToast: true },
      // 계약이 전체 치환이라 응답이 곧 최신 상태다 — 재조회 없이 캐시에 그대로 꽂는다.
      onSuccess: (result) => {
        if (result.status !== 200 || !result.data.success) return;
        queryClient.setQueryData(
          getGetNotificationPreferencesQueryKey(),
          result
        );
      },
      onError: () =>
        toast.error("설정을 저장하지 못했습니다. 다시 시도해 주세요.", {
          id: "notification-preferences",
        }),
    },
  });

  // 도는 동안에는 **누른 값**을 보여준다. 서버 값을 그리면 스위치가 눌린 뒤 한 번 되돌아갔다가
  // 응답이 와서 다시 넘어가는 것처럼 깜빡인다.
  const shown = update.isPending && update.variables?.data
    ? (update.variables.data as NotificationPreferences)
    : preferences;

  const toggle = (key: PreferenceKey, next: boolean) => {
    update.mutate({ data: { ...shown, [key]: next } });
  };

  return (
    <>
      {GROUPS.map((group, index) => (
        <div key={group.label} className="contents">
          {index > 0 ? <SettingsGap /> : null}
          <SettingsSection title={group.label} note={group.note}>
            {group.items.map((item) => (
              <SettingsRow
                key={item.key}
                label={item.title}
                description={item.detail}
              >
                <Switch
                  aria-label={item.title}
                  checked={shown[item.key]}
                  disabled={update.isPending}
                  onCheckedChange={(next) => toggle(item.key, next)}
                />
              </SettingsRow>
            ))}
          </SettingsSection>
        </div>
      ))}
    </>
  );
}

export function NotificationsSettingsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-label="알림 설정 불러오는 중">
      {[4, 2].map((rows, index) => (
        <div key={index} className="flex flex-col">
          <Skeleton className="mb-2 h-3 w-20" />
          {Array.from({ length: rows }).map((_, row) => (
            <div
              key={row}
              className="flex h-[58px] items-center gap-4 border-b border-[var(--el-hairline)]"
            >
              <div className="flex-1">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="mt-2 h-2.5 w-56" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
