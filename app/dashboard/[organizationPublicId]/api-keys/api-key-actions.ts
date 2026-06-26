import {
  createApiKey,
  getListApiKeysQueryKey,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
} from "@/lib/api/generated/api-keys/api-keys";
import type {
  ApiKeyListResponse,
  ApiKeyResponse,
  ApiKeyStatusFilter,
  CreateApiKeyResponse,
} from "@/lib/api/generated/models";
import {
  toAppResponseError,
  unwrapGeneratedAppResponse,
} from "@/lib/api/app-response";

import { normalizeKeyName } from "./api-key-helpers";

export function apiKeysQueryKey(
  organizationPublicId: string,
  status: ApiKeyStatusFilter
) {
  return getListApiKeysQueryKey(organizationPublicId, { status, limit: 50 });
}

export async function getApiKeys(
  organizationPublicId: string,
  status: ApiKeyStatusFilter
): Promise<ApiKeyListResponse> {
  try {
    const response = await listApiKeys(organizationPublicId, { status, limit: 50 });

    return unwrapGeneratedAppResponse(response);
  } catch (error) {
    throw toAppResponseError(error, "Failed to load API keys.");
  }
}

export async function createOrganizationApiKey(
  organizationPublicId: string,
  name: string
): Promise<CreateApiKeyResponse> {
  try {
    const normalizedName = normalizeKeyName(name);
    const response = await createApiKey(organizationPublicId, {
      name: normalizedName || null,
    });

    return unwrapGeneratedAppResponse(response);
  } catch (error) {
    throw toAppResponseError(error, "Failed to create API key.");
  }
}

export async function renameOrganizationApiKey(
  organizationPublicId: string,
  keyId: string,
  name: string
): Promise<ApiKeyResponse> {
  try {
    const response = await updateApiKey(organizationPublicId, keyId, {
      name: normalizeKeyName(name),
    });

    return unwrapGeneratedAppResponse(response);
  } catch (error) {
    throw toAppResponseError(error, "Failed to rename API key.");
  }
}

export async function revokeOrganizationApiKey(
  organizationPublicId: string,
  keyId: string
): Promise<ApiKeyResponse> {
  try {
    const response = await revokeApiKey(organizationPublicId, keyId);

    return unwrapGeneratedAppResponse(response);
  } catch (error) {
    throw toAppResponseError(error, "Failed to revoke API key.");
  }
}

export { getApiKeys as listOrganizationApiKeys };
