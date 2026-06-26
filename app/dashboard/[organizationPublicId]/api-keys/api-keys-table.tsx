"use client";

import { Pencil, Trash2 } from "lucide-react";

import type { ApiKeyResponse } from "@/lib/api/generated/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  formatApiKeyTimestamp,
  formatCreatedBy,
  formatKeyName,
  getApiKeyStatusBadgeVariant,
  getApiKeyStatusLabel,
} from "./api-key-helpers";

type ApiKeysTableProps = {
  apiKeys: ApiKeyResponse[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onRename: (apiKey: ApiKeyResponse) => void;
  onRevoke: (apiKey: ApiKeyResponse) => void;
};

export function ApiKeysTable({
  apiKeys,
  isLoading,
  errorMessage,
  onRetry,
  onRename,
  onRevoke,
}: ApiKeysTableProps) {
  if (errorMessage) {
    return (
      <section className="rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-6">
        <p className="text-sm font-medium text-[var(--clay-primary)]">
          API keys could not be loaded.
        </p>
        <p className="mt-2 text-sm text-[var(--clay-muted)]">{errorMessage}</p>
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <section className="overflow-x-auto rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)]">
      <table className="min-w-[940px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[20%]" />
          <col className="w-[11%]" />
          <col className="w-[15%]" />
          <col className="w-[15%]" />
          <col className="w-[14%]" />
          <col className="w-[9%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--clay-hairline)] text-xs font-semibold uppercase tracking-[0.08em] text-[var(--clay-muted)]">
            <th className="px-5 py-3 font-semibold">Name</th>
            <th className="px-5 py-3 font-semibold">Secret key</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Created</th>
            <th className="px-5 py-3 font-semibold">Last used</th>
            <th className="px-5 py-3 font-semibold">Created by</th>
            <th className="px-5 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td className="px-5 py-8 text-[var(--clay-muted)]" colSpan={7}>
                Loading API keys…
              </td>
            </tr>
          ) : apiKeys.length === 0 ? (
            <tr>
              <td className="px-5 py-8 text-[var(--clay-muted)]" colSpan={7}>
                No API keys match this filter.
              </td>
            </tr>
          ) : (
            apiKeys.map((apiKey) => (
              <tr
                key={apiKey.id}
                className="border-b border-[var(--clay-hairline)] last:border-b-0"
              >
                <td className="px-5 py-4">
                  <span className="block truncate font-medium text-[var(--clay-primary)]">
                    {formatKeyName(apiKey.name)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <code className="block truncate rounded-md border border-[var(--clay-hairline)] bg-[var(--clay-surface-soft)] px-2 py-1 font-mono text-xs text-[var(--clay-muted)]">
                    {apiKey.maskedKey}
                  </code>
                </td>
                <td className="px-5 py-4">
                  <Badge variant={getApiKeyStatusBadgeVariant(apiKey.status)}>
                    {getApiKeyStatusLabel(apiKey.status)}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-[var(--clay-muted)]">
                  {formatApiKeyTimestamp(apiKey.createdAt)}
                </td>
                <td className="px-5 py-4 text-[var(--clay-muted)]">
                  {formatApiKeyTimestamp(apiKey.lastUsedAt)}
                </td>
                <td className="px-5 py-4 text-[var(--clay-muted)]">
                  <span className="block truncate">
                    {formatCreatedBy(apiKey.createdBy)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-[var(--clay-muted)] hover:bg-[var(--clay-surface-strong)] hover:text-[var(--clay-primary)]"
                      onClick={() => onRename(apiKey)}
                      aria-label={`Rename ${formatKeyName(apiKey.name)}`}
                      title="Rename"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {apiKey.status === "ACTIVE" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onRevoke(apiKey)}
                        aria-label={`Revoke ${formatKeyName(apiKey.name)}`}
                        title="Revoke"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
