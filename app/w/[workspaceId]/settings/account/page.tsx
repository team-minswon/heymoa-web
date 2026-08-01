import {
  AccountSettingsForm,
  AccountSettingsFormSkeleton,
} from "@/components/settings/account-settings-form";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { DataBoundary } from "@/components/ui/data-boundary";

export default function AccountSettingsRoute() {
  return (
    <SettingsPageShell
      title="내 계정"
      description="계정 정보와 기본 워크스페이스를 관리합니다."
    >
      <DataBoundary
        fallback={<AccountSettingsFormSkeleton />}
        errorLabel="계정 정보를 불러오지 못했습니다"
        resetKeys={["account"]}
      >
        <AccountSettingsForm />
      </DataBoundary>
    </SettingsPageShell>
  );
}
