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
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Manage the workspace, API access, and account-level settings for this
        organization.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        {[
          ["Public ID", organization.publicId],
          ["Role", organization.role],
          ["Plan", organization.planCode],
          ["Members", organization.memberCount ?? "Unknown"],
        ].map(([label, value]) => (
          <div key={label} className="border border-border bg-muted p-4">
            <p className="font-mono text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="border border-border p-5">
          <h2 className="text-base font-semibold">Next rebuild steps</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            API key management is rebuilt in #12. This dashboard shell now has
            the stable organization context those pages will use.
          </p>
        </div>
        <div className="border border-border p-5">
          <h2 className="text-base font-semibold">Access model</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Organization data is loaded through server-side API calls with the
            current session cookies.
          </p>
        </div>
      </div>
    </section>
  );
}
