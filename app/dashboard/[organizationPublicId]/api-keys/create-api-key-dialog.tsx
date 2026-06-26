"use client";

import * as React from "react";
import { Copy } from "lucide-react";

import type { CreateApiKeyResponse } from "@/lib/api/generated/models";
import { getErrorMessage } from "@/lib/api/app-response";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

import { normalizeKeyName } from "./api-key-helpers";

type CreateApiKeyDialogProps = {
  open: boolean;
  secret: CreateApiKeyResponse | null;
  isPending: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void>;
};

export function CreateApiKeyDialog({
  open,
  secret,
  isPending,
  error,
  onOpenChange,
  onCreate,
}: CreateApiKeyDialogProps) {
  const [name, setName] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate(normalizeKeyName(name));
  }

  async function handleCopy() {
    if (!secret) {
      return;
    }

    await navigator.clipboard.writeText(secret.secretKey);
    setCopied(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <div className="space-y-5 p-6">
            {secret ? (
              <>
                <div>
                  <Dialog.Title>Copy your API key</Dialog.Title>
                  <Dialog.Description className="mt-2">
                    This secret is only shown once. Copy it now and store it in a
                    safe place.
                  </Dialog.Description>
                </div>
                <div className="rounded-lg border border-[var(--clay-hairline)] bg-[var(--clay-surface-soft)] p-3">
                  <p className="text-xs font-medium text-[var(--clay-muted)]">
                    Secret key
                  </p>
                  <code className="mt-2 block break-all font-mono text-sm text-[var(--clay-primary)]">
                    {secret.secretKey}
                  </code>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  You will not be able to view this secret again after closing
                  this dialog.
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCopy}>
                    <Copy className="size-4" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Dialog.Close render={<Button />}>Close</Dialog.Close>
                </div>
              </>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <Dialog.Title>Create API key</Dialog.Title>
                  <Dialog.Description className="mt-2">
                    Give this key an optional name so your team can recognize it
                    later.
                  </Dialog.Description>
                </div>
                <label className="block space-y-2 text-sm">
                  <span className="font-medium text-[var(--clay-primary)]">
                    Name
                  </span>
                  <input
                    className="h-9 w-full rounded-lg border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] px-3 text-sm outline-none focus:border-[var(--clay-primary)]"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Production app"
                    disabled={isPending}
                  />
                </label>
                {error ? (
                  <p className="text-sm text-destructive">
                    {getErrorMessage(error, "Failed to create API key.")}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Dialog.Close render={<Button variant="outline" />} disabled={isPending}>
                    Cancel
                  </Dialog.Close>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Creating…" : "Create key"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog>
  );
}
