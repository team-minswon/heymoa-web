"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ApiKeyResponse,
  ApiKeyStatusFilter,
  CreateApiKeyResponse,
} from "@/lib/api/generated/models";
import { getErrorMessage } from "@/lib/api/app-response";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AnimatePresence, motion } from "motion/react";

import {
  apiKeysQueryKey,
  createOrganizationApiKey,
  getApiKeys,
  renameOrganizationApiKey,
  revokeOrganizationApiKey,
} from "./api-key-actions";
import { ApiKeysTable } from "./api-keys-table";
import {
  API_KEY_STATUS_FILTERS,
  type ApiKeyStatusFilterValue,
} from "./api-key-helpers";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { RenameApiKeyDialog } from "./rename-api-key-dialog";
import { RevokeApiKeyDialog } from "./revoke-api-key-dialog";

type ApiKeysManagerProps = {
  organizationPublicId: string;
};

export function ApiKeysManager({ organizationPublicId }: ApiKeysManagerProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] =
    React.useState<ApiKeyStatusFilterValue>("active");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createdSecret, setCreatedSecret] =
    React.useState<CreateApiKeyResponse | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<ApiKeyResponse | null>(
    null
  );
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKeyResponse | null>(
    null
  );

  const listQuery = useQuery({
    queryKey: apiKeysQueryKey(organizationPublicId, statusFilter),
    queryFn: () => getApiKeys(organizationPublicId, statusFilter),
  });

  const invalidateCurrentList = React.useCallback(() => {
    return Promise.all(
      API_KEY_STATUS_FILTERS.map((filter) =>
        queryClient.invalidateQueries({
          queryKey: apiKeysQueryKey(organizationPublicId, filter.value),
        })
      )
    );
  }, [organizationPublicId, queryClient]);

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      createOrganizationApiKey(organizationPublicId, name),
    onSuccess: async (secret) => {
      setCreatedSecret(secret);
      await invalidateCurrentList();
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ keyId, name }: { keyId: string; name: string }) =>
      renameOrganizationApiKey(organizationPublicId, keyId, name),
    onSuccess: async () => {
      setRenameTarget(null);
      await invalidateCurrentList();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) =>
      revokeOrganizationApiKey(organizationPublicId, keyId),
    onSuccess: async () => {
      setRevokeTarget(null);
      await invalidateCurrentList();
    },
  });

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open);

    if (!open) {
      setCreatedSecret(null);
      createMutation.reset();
    }
  }

  function handleRenameOpenChange(open: boolean) {
    if (!open) {
      setRenameTarget(null);
      renameMutation.reset();
    }
  }

  function handleRevokeOpenChange(open: boolean) {
    if (!open) {
      setRevokeTarget(null);
      revokeMutation.reset();
    }
  }

  function handleStatusFilterChange(nextStatus: ApiKeyStatusFilter) {
    setStatusFilter(nextStatus);
  }

  const apiKeys = listQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">API Keys</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--clay-muted)]">
            Create and manage organization API keys for Realillust API access.
            Store new secrets safely; they are only shown once.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create API key
        </Button>
      </div>

      <ToggleGroup
        value={[statusFilter]}
        onValueChange={(value) => {
          const val = value[0];
          if (val) handleStatusFilterChange(val as ApiKeyStatusFilter);
        }}
        className="inline-flex rounded-lg border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-1"
      >
        {API_KEY_STATUS_FILTERS.map((filter) => (
          <ToggleGroupItem
            key={filter.value}
            value={filter.value}
            className="rounded-md px-3 py-1 text-sm font-medium text-[var(--clay-muted)] transition-all cursor-pointer hover:bg-[var(--clay-surface-strong)] hover:text-[var(--clay-primary)] aria-pressed:bg-[var(--clay-primary)] aria-pressed:text-white! data-[state=on]:bg-[var(--clay-primary)] data-[state=on]:text-white!"
          >
            {filter.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <AnimatePresence mode="wait">
        <motion.div
          key={statusFilter}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <ApiKeysTable
            apiKeys={apiKeys}
            isLoading={listQuery.isLoading}
            errorMessage={
              listQuery.error
                ? getErrorMessage(listQuery.error, "Failed to load API keys.")
                : null
            }
            onRetry={() => void listQuery.refetch()}
            onRename={(apiKey) => {
              renameMutation.reset();
              setRenameTarget(apiKey);
            }}
            onRevoke={(apiKey) => {
              revokeMutation.reset();
              setRevokeTarget(apiKey);
            }}
          />
        </motion.div>
      </AnimatePresence>

      <CreateApiKeyDialog
        open={createOpen}
        secret={createdSecret}
        isPending={createMutation.isPending}
        error={createMutation.error}
        onOpenChange={handleCreateOpenChange}
        onCreate={(name) =>
          createMutation.mutateAsync(name).then(() => undefined)
        }
      />

      <RenameApiKeyDialog
        apiKey={renameTarget}
        isPending={renameMutation.isPending}
        error={renameMutation.error}
        onOpenChange={handleRenameOpenChange}
        onRename={(name) => {
          if (!renameTarget) {
            return Promise.resolve();
          }

          return renameMutation
            .mutateAsync({ keyId: renameTarget.id, name })
            .then(() => undefined);
        }}
      />

      <RevokeApiKeyDialog
        apiKey={revokeTarget}
        isPending={revokeMutation.isPending}
        error={revokeMutation.error}
        onOpenChange={handleRevokeOpenChange}
        onConfirm={() => {
          if (!revokeTarget) {
            return Promise.resolve();
          }

          return revokeMutation
            .mutateAsync(revokeTarget.id)
            .then(() => undefined);
        }}
      />
    </div>
  );
}
