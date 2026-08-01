"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { toast } from "sonner";

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
  items: { key: PreferenceKey; title: string; detail: string }[];
}[] = [
  {
    label: "앱 안에서",
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
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <section key={group.label} className="flex flex-col">
          <h2 className="pb-1 text-[13px] font-bold text-[var(--el-ink)]">
            {group.label}
          </h2>
          <div className="flex flex-col">
            {group.items.map((item) => (
              <label
                key={item.key}
                className="flex h-[60px] cursor-pointer items-center gap-4 border-b border-[var(--el-hairline)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-[var(--el-ink)]">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[var(--el-muted)]">
                    {item.detail}
                  </span>
                </span>
                <Switch
                  checked={shown[item.key]}
                  disabled={update.isPending}
                  onCheckedChange={(next) => toggle(item.key, next)}
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <p className="flex gap-2.5 text-[11px] leading-5 text-[var(--el-muted)]">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        예정 시각 알림은 회의에 일시가 지정돼야 보낼 수 있습니다.
      </p>
    </div>
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
              className="flex h-[60px] items-center gap-4 border-b border-[var(--el-hairline)]"
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
