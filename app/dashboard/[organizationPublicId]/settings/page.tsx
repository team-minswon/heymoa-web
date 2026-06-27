import { StatusCard } from "@/components/dashboard/status-card";
import { getOrganizationForSsr } from "@/lib/organization/server";
import { OrganizationSettingsForm } from "./organization-settings-form";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ organizationPublicId: string }>;
}) {
  const { organizationPublicId } = await params;
  const organization = await getOrganizationForSsr(organizationPublicId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">
          Organization 정보를 관리합니다.
        </p>
      </div>
      <OrganizationSettingsForm organization={organization} />
      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard label="Public ID" value={organization.publicId} />
        <StatusCard label="Plan" value={organization.planCode} />
        <StatusCard label="Role" value={organization.role} />
      </div>
    </div>
  );
}
