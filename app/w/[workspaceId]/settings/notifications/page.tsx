import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import {
  NotificationsSettings,
  NotificationsSettingsSkeleton,
} from "@/components/settings/notifications-settings";
import { DataBoundary } from "@/components/ui/data-boundary";

export default function NotificationsSettingsRoute() {
  return (
    <SettingsPageShell
      title="알림"
      description="무엇을 언제 알릴지 정합니다. 앱 안 알림은 종 아이콘에, 메일은 로그인한 주소로 갑니다."
    >
      <DataBoundary
        fallback={<NotificationsSettingsSkeleton />}
        errorLabel="알림 설정을 불러오지 못했습니다"
      >
        <NotificationsSettings />
      </DataBoundary>
    </SettingsPageShell>
  );
}
