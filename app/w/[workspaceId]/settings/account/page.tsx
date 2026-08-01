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
      description="프로필 정보를 확인합니다. 이름과 사진은 로그인한 구글 계정을 따릅니다."
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
