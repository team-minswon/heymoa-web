import { getOrganizationForSsr } from "@/lib/organization/server";

type WebhooksPageProps = {
  params: Promise<{ organizationPublicId: string }>;
};

export default async function WebhooksPage({ params }: WebhooksPageProps) {
  const { organizationPublicId } = await params;
  const organization = await getOrganizationForSsr(organizationPublicId);

  return (
    <section>
      <p className="font-mono text-sm text-muted-foreground">Webhooks</p>
      <h1 className="mt-4 text-3xl font-semibold">Webhooks</h1>
      <p className="mt-4 text-muted-foreground">
        Webhook delivery is not enabled for {organization.name} yet.
      </p>
      <div className="mt-8 border border-border bg-muted p-5">
        <h2 className="text-base font-semibold">No endpoints configured</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          This page reserves the dashboard surface for future webhook delivery
          settings while the rebuild focuses on organization and API key flows.
        </p>
      </div>
    </section>
  );
}
