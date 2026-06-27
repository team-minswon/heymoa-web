import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getOrganizationForSsr } from "@/lib/organization/server";

type OrganizationDashboardLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ organizationPublicId: string }>;
};

export default async function OrganizationDashboardLayout({
  children,
  params,
}: OrganizationDashboardLayoutProps) {
  const { organizationPublicId } = await params;
  const organization = await getOrganizationForSsr(organizationPublicId);

  return (
    <DashboardShell organization={organization}>{children}</DashboardShell>
  );
}
