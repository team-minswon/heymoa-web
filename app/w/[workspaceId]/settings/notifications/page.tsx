import {
  NotificationsSettings,
  NotificationsSettingsSkeleton,
} from "@/components/settings/notifications-settings";
import { DataBoundary } from "@/components/ui/data-boundary";

export default function NotificationsSettingsRoute() {
  return (
    <>
      <DataBoundary
        fallback={<NotificationsSettingsSkeleton />}
        errorLabel="알림 설정을 불러오지 못했습니다"
      >
        <NotificationsSettings />
      </DataBoundary>
    </>
  );
}
