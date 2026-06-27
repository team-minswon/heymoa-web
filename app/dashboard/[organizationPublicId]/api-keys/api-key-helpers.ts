import type {
  ApiKeyCreatedBy,
  ApiKeyStatus,
  ApiKeyStatusFilter,
} from "@/lib/api/generated/models";

export type ApiKeyStatusFilterValue = ApiKeyStatusFilter;

export const API_KEY_STATUS_FILTERS: Array<{
  value: ApiKeyStatusFilterValue;
  label: string;
}> = [
  { value: "active", label: "Active" },
  { value: "revoked", label: "Revoked" },
  { value: "all", label: "All" },
];

export function formatApiKeyTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatCreatedBy(createdBy: ApiKeyCreatedBy | null | undefined) {
  if (!createdBy) {
    return "Unknown user";
  }

  return createdBy.name?.trim() || `User #${createdBy.id}`;
}

export function formatKeyName(name: string | null | undefined) {
  return name?.trim() || "Untitled key";
}

export function getApiKeyStatusLabel(status: ApiKeyStatus) {
  return status === "REVOKED" ? "Revoked" : "Active";
}

export function getApiKeyStatusBadgeVariant(status: ApiKeyStatus) {
  return status === "REVOKED" ? "outline" : "secondary";
}

export function normalizeKeyName(name: string) {
  return name.trim();
}
