import { getOrganizationForSsr } from "@/lib/organization/server";

type UsagePageProps = {
  params: Promise<{ organizationPublicId: string }>;
};

export default async function UsagePage({ params }: UsagePageProps) {
  const { organizationPublicId } = await params;
  const organization = await getOrganizationForSsr(organizationPublicId);
  const metrics = [
    ["Plan", organization.planCode],
    ["Monthly inspections", "0"],
    ["API requests", "0"],
    ["Storage", "0 MB"],
  ];

  return (
    <section>
      <p className="font-mono text-sm text-muted-foreground">Usage</p>
      <h1 className="mt-4 text-3xl font-semibold">Usage</h1>
      <p className="mt-4 text-muted-foreground">
        Usage metrics are ready for the server usage endpoint when it lands.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="border border-border bg-muted p-4">
            <p className="font-mono text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
