import {
  AccountSettingsForm,
  AccountSettingsFormSkeleton,
} from "@/components/settings/account-settings-form";
import { DataBoundary } from "@/components/ui/data-boundary";

export default function AccountSettingsRoute() {
  return (
    <>
      <DataBoundary
        fallback={<AccountSettingsFormSkeleton />}
        errorLabel="계정 정보를 불러오지 못했습니다"
        resetKeys={["account"]}
      >
        <AccountSettingsForm />
      </DataBoundary>
    </>
  );
}
