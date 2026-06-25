import { ComingSoonPanel } from "@/components/dashboard/coming-soon-panel";
import { StatusCard } from "@/components/dashboard/status-card";
import { getOrganizationForSsr } from "@/lib/organization/server";

export default async function OrganizationOverviewPage({
  params,
}: {
  params: Promise<{ organizationPublicId: string }>;
}) {
  const { organizationPublicId } = await params;
  const organization = await getOrganizationForSsr(organizationPublicId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Overview</h1>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">
          API 사용 준비 상태를 확인합니다.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard label="Plan" value={organization.planCode} />
        <StatusCard label="Members" value={String(organization.memberCount)} />
        <StatusCard label="Role" value={organization.role} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ComingSoonPanel title="API Keys" />
        <ComingSoonPanel title="Webhooks" />
        <ComingSoonPanel title="Usage" />
      </div>
    </div>
  );
}
