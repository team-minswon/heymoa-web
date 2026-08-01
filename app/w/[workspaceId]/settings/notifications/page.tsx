import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { NotificationsSettings } from "@/components/settings/notifications-settings";

export default function NotificationsSettingsRoute() {
  return (
    <SettingsPageShell
      title="알림"
      description="무엇을 언제 알려줄지 정합니다."
    >
      <NotificationsSettings />
    </SettingsPageShell>
  );
}
