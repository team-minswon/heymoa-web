import { ApiKeysManager } from "./api-keys-manager";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ organizationPublicId: string }>;
}) {
  const { organizationPublicId } = await params;

  return <ApiKeysManager organizationPublicId={organizationPublicId} />;
}
