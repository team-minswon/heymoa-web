import {
  AccountSettingsForm,
  AccountSettingsFormSkeleton,
} from "@/components/settings/account-settings-form";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import { DataBoundary } from "@/components/ui/data-boundary";

export default function AccountSettingsRoute() {
  return (
    <SettingsPageShell>
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
