"use client";

import { Bell } from "lucide-react";

import { useNotificationCenter } from "@/components/notification/notification-center";
import { Button } from "@/components/ui/button";

/**
 * 노트 상단바의 알림 진입점. 알림에서 들어왔으면 「알림 목록으로」가 모달을 연다(닫을 때의 탭·스크롤이 그대로다).
 * 아니면 전체 화면에서만 작은 벨을 둔다 — 전체 화면은 사이드바를 덮어 「알림」에 닿을 수 없다. 사이드 뷰는 사이드바가 보인다.
 */
export function NoteNotificationEntry({
  view,
  fromNotification,
}: {
  view: "side" | "full";
  fromNotification: boolean;
}) {
  const center = useNotificationCenter();
  if (!center) return null;
  if (fromNotification) {
    // 좁은 폭(1024 + 에이전트 레일)에서는 글을 빼고 아이콘만 둔다 — 상단바 제목이 0px 로 줄지 않게.
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="알림 목록으로 돌아가기"
        className="shrink-0 rounded-control text-[var(--el-muted)]"
        onClick={center.openNotifications}
      >
        <Bell />
        <span className="hidden 2xl:inline">알림 목록</span>
      </Button>
    );
  }
  if (view !== "full") return null;
  const count = center.unreadCount ?? 0;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={
        count > 0 ? `알림 열기, 안 읽은 알림 ${count}개` : "알림 열기"
      }
      className="relative shrink-0 rounded-control text-[var(--el-muted)]"
      onClick={center.openNotifications}
    >
      <Bell />
      {count > 0 ? (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[var(--el-primary)]"
        />
      ) : null}
    </Button>
  );
}
