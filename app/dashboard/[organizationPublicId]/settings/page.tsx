import { OrganizationSettingsForm } from "@/components/dashboard/organization-settings-form";
import { getOrganizationForSsr } from "@/lib/organization/server";

type SettingsPageProps = {
  params: Promise<{ organizationPublicId: string }>;
};

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { organizationPublicId } = await params;
  const organization = await getOrganizationForSsr(organizationPublicId);

  return (
    <section>
      <p className="font-mono text-sm text-muted-foreground">Settings</p>
      <h1 className="mt-4 text-3xl font-semibold">Organization settings</h1>
      <p className="mt-4 text-muted-foreground">
        Update organization-level details used across the dashboard.
      </p>
      <OrganizationSettingsForm
        initialName={organization.name}
        organizationPublicId={organization.publicId}
      />
    </section>
  );
}
