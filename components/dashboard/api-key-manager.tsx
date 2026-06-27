"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  createApiKeyApi,
  listApiKeysApi,
  revokeApiKeyApi,
  updateApiKeyApi,
} from "@/lib/api/endpoints";
import type { ApiKeyResponse, CreateApiKeyResponse } from "@/lib/api/generated";

type ApiKeyManagerProps = {
  organizationPublicId: string;
};

type LoadStatus = "loading" | "ready" | "error";

export function ApiKeyManager({ organizationPublicId }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(
    null
  );
  const [newKeyName, setNewKeyName] = useState("");
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [busyKeyId, setBusyKeyId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setStatus("loading");

    try {
      const response = await listApiKeysApi(organizationPublicId, {
        status: "all",
      });

      setKeys(response.items);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [organizationPublicId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadKeys();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadKeys]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newKeyName.trim();

    try {
      const response = await createApiKeyApi(organizationPublicId, {
        name: name || null,
      });

      setCreatedKey(response);
      setNewKeyName("");
      await loadKeys();
    } catch {
      setStatus("error");
    }
  }

  async function handleRename(keyId: string, name: string) {
    setBusyKeyId(keyId);

    try {
      const updated = await updateApiKeyApi(organizationPublicId, keyId, {
        name,
      });

      setKeys((current) =>
        current.map((key) => (key.id === keyId ? updated : key))
      );
    } finally {
      setBusyKeyId(null);
    }
  }

  async function handleRevoke(keyId: string) {
    setBusyKeyId(keyId);

    try {
      const revoked = await revokeApiKeyApi(organizationPublicId, keyId);

      setKeys((current) =>
        current.map((key) => (key.id === keyId ? revoked : key))
      );
    } finally {
      setBusyKeyId(null);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <form
        className="border border-border bg-muted p-5"
        onSubmit={handleCreate}
      >
        <label className="text-sm font-medium" htmlFor="api-key-name">
          New API key
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="api-key-name"
            className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
            maxLength={255}
            onChange={(event) => setNewKeyName(event.target.value)}
            placeholder="Production key"
            value={newKeyName}
          />
          <button
            className="border border-border bg-foreground px-4 py-2 text-sm font-medium text-background"
            type="submit"
          >
            Create key
          </button>
        </div>
      </form>

      {createdKey ? (
        <div className="border border-border bg-background p-5">
          <p className="text-sm font-semibold">Secret key created</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This value is only shown once.
          </p>
          <code className="mt-4 block overflow-x-auto border border-border bg-muted p-3 text-sm">
            {createdKey.secretKey}
          </code>
        </div>
      ) : null}

      {status === "loading" ? (
        <p className="text-sm text-muted-foreground">Loading API keys...</p>
      ) : null}

      {status === "error" ? (
        <div className="border border-border bg-muted p-5">
          <p className="text-sm font-semibold">Could not load API keys</p>
          <button
            className="mt-4 border border-border bg-background px-3 py-2 text-sm font-medium"
            onClick={() => void loadKeys()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {status === "ready" ? (
        <div className="overflow-hidden border border-border">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((apiKey) => (
                <ApiKeyRow
                  apiKey={apiKey}
                  busy={busyKeyId === apiKey.id}
                  key={apiKey.id}
                  onRename={handleRename}
                  onRevoke={handleRevoke}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

type ApiKeyRowProps = {
  apiKey: ApiKeyResponse;
  busy: boolean;
  onRename: (keyId: string, name: string) => Promise<void>;
  onRevoke: (keyId: string) => Promise<void>;
};

function ApiKeyRow({ apiKey, busy, onRename, onRevoke }: ApiKeyRowProps) {
  const [name, setName] = useState(apiKey.name);
  const isRevoked = apiKey.status.toUpperCase() === "REVOKED";

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3">
        <input
          className="w-full border border-border bg-background px-2 py-1 text-sm outline-none focus:border-foreground"
          disabled={busy || isRevoked}
          maxLength={255}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {apiKey.maskedKey}
      </td>
      <td className="px-4 py-3">{apiKey.status}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
          new Date(apiKey.createdAt)
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            className="border border-border px-3 py-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || isRevoked || !name.trim() || name === apiKey.name}
            onClick={() => void onRename(apiKey.id, name.trim())}
            type="button"
          >
            Save
          </button>
          <button
            className="border border-border px-3 py-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            disabled={busy || isRevoked}
            onClick={() => void onRevoke(apiKey.id)}
            type="button"
          >
            Revoke
          </button>
        </div>
      </td>
    </tr>
  );
}
