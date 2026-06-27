import { getOrganizationForSsr } from "@/lib/organization/server";

type OrganizationOverviewPageProps = {
  params: Promise<{ organizationPublicId: string }>;
};

export default async function OrganizationOverviewPage({
  params,
}: OrganizationOverviewPageProps) {
  const { organizationPublicId } = await params;
  const organization = await getOrganizationForSsr(organizationPublicId);

  return (
    <section>
      <p className="font-mono text-sm text-muted-foreground">Overview</p>
      <h1 className="mt-4 text-3xl font-semibold">{organization.name}</h1>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Public ID", organization.publicId],
          ["Role", organization.role],
          ["Plan", organization.planCode],
        ].map(([label, value]) => (
          <div key={label} className="border border-border bg-muted p-4">
            <p className="font-mono text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
