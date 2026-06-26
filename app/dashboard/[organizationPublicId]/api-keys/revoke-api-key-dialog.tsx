"use client";

import type { ApiKeyResponse } from "@/lib/api/generated/models";
import { getErrorMessage } from "@/lib/api/app-response";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { formatKeyName } from "./api-key-helpers";

type RevokeApiKeyDialogProps = {
  apiKey: ApiKeyResponse | null;
  isPending: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
};

export function RevokeApiKeyDialog({
  apiKey,
  isPending,
  error,
  onOpenChange,
  onConfirm,
}: RevokeApiKeyDialogProps) {
  return (
    <AlertDialog open={Boolean(apiKey)} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop />
        <AlertDialog.Popup>
          <div className="space-y-5 p-6">
            <div>
              <AlertDialog.Title>Revoke API key?</AlertDialog.Title>
              <AlertDialog.Description className="mt-2">
                {formatKeyName(apiKey?.name)} will stop working immediately and
                cannot be reactivated.
              </AlertDialog.Description>
            </div>
            {error ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(error, "Failed to revoke API key.")}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <AlertDialog.Close
                render={<Button variant="outline" />}
                disabled={isPending}
              >
                Cancel
              </AlertDialog.Close>
              <Button
                variant="destructive"
                onClick={onConfirm}
                loading={isPending}
              >
                Revoke key
              </Button>
            </div>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog>
  );
}
