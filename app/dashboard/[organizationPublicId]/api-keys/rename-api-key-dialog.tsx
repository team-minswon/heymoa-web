"use client";

import * as React from "react";

import type { ApiKeyResponse } from "@/lib/api/generated/models";
import { getErrorMessage } from "@/lib/api/app-response";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

import { formatKeyName, normalizeKeyName } from "./api-key-helpers";

type RenameApiKeyDialogProps = {
  apiKey: ApiKeyResponse | null;
  isPending: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onRename: (name: string) => Promise<void>;
};

export function RenameApiKeyDialog({
  apiKey,
  isPending,
  error,
  onOpenChange,
  onRename,
}: RenameApiKeyDialogProps) {
  const [name, setName] = React.useState(apiKey?.name ?? "");
  const trimmedName = normalizeKeyName(name);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trimmedName) {
      return;
    }

    await onRename(trimmedName);
  }

  return (
    <Dialog open={Boolean(apiKey)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <form className="space-y-5 p-6" onSubmit={handleSubmit}>
            <div>
              <Dialog.Title>Rename API key</Dialog.Title>
              <Dialog.Description className="mt-2">
                Update the display name for {formatKeyName(apiKey?.name)}.
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
                disabled={isPending}
                autoFocus
              />
            </label>
            {!trimmedName ? (
              <p className="text-sm text-destructive">Name is required.</p>
            ) : error ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(error, "Failed to rename API key.")}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Dialog.Close render={<Button variant="outline" />} disabled={isPending}>
                Cancel
              </Dialog.Close>
              <Button type="submit" disabled={isPending || !trimmedName}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog>
  );
}
