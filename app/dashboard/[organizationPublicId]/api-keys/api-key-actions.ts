import {
  createApiKeyApi,
  listApiKeysApi,
  revokeApiKeyApi,
  updateApiKeyApi,
} from "@/lib/api/endpoints";
import type {
  ApiKeyListResponse,
  ApiKeyResponse,
  ApiKeyStatusFilter,
  CreateApiKeyResponse,
} from "@/lib/api/generated";

import { normalizeKeyName } from "./api-key-helpers";

export function apiKeysQueryKey(
  organizationPublicId: string,
  status: ApiKeyStatusFilter
) {
  return ["api-keys", organizationPublicId, status, 50] as const;
}

export async function getApiKeys(
  organizationPublicId: string,
  status: ApiKeyStatusFilter
): Promise<ApiKeyListResponse> {
  try {
    return await listApiKeysApi(organizationPublicId, {
      status,
      limit: 50,
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Failed to load API keys.");
  }
}

export async function createOrganizationApiKey(
  organizationPublicId: string,
  name: string
): Promise<CreateApiKeyResponse> {
  try {
    const normalizedName = normalizeKeyName(name);
    return await createApiKeyApi(organizationPublicId, {
      name: normalizedName || null,
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Failed to create API key.");
  }
}

export async function renameOrganizationApiKey(
  organizationPublicId: string,
  keyId: string,
  name: string
): Promise<ApiKeyResponse> {
  try {
    return await updateApiKeyApi(organizationPublicId, keyId, {
      name: normalizeKeyName(name),
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Failed to rename API key.");
  }
}

export async function revokeOrganizationApiKey(
  organizationPublicId: string,
  keyId: string
): Promise<ApiKeyResponse> {
  try {
    return await revokeApiKeyApi(organizationPublicId, keyId);
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Failed to revoke API key.");
  }
}

export { getApiKeys as listOrganizationApiKeys };
