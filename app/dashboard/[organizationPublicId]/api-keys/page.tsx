import { ApiKeyManager } from "@/components/dashboard/api-key-manager";

type ApiKeysPageProps = {
  params: Promise<{ organizationPublicId: string }>;
};

export default async function ApiKeysPage({ params }: ApiKeysPageProps) {
  const { organizationPublicId } = await params;

  return (
    <section>
      <p className="font-mono text-sm text-muted-foreground">API Keys</p>
      <h1 className="mt-4 text-3xl font-semibold">API key management</h1>
      <p className="mt-4 text-muted-foreground">
        Create, rename, and revoke organization API keys.
      </p>
      <ApiKeyManager organizationPublicId={organizationPublicId} />
    </section>
  );
}
