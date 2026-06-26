"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { updateOrganizationName } from "@/lib/organization/api";
import type { OrganizationDetail } from "@/lib/organization/types";

export function OrganizationSettingsForm({
  organization,
}: {
  organization: OrganizationDetail;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(organization.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="rounded-xl border border-[var(--clay-hairline)] bg-[var(--clay-surface-card)] p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await updateOrganizationName(organization.publicId, name.trim());
            await queryClient.invalidateQueries({
              queryKey: ["organizations"],
            });
            router.refresh();
          } catch (e: unknown) {
            setError(
              e instanceof Error
                ? e.message
                : "조직 이름을 수정하지 못했습니다."
            );
          }
        });
      }}
    >
      <label
        className="text-sm font-semibold text-[var(--clay-muted)]"
        htmlFor="organization-name"
      >
        Organization name
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="organization-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--clay-hairline)] bg-[var(--clay-canvas)] px-3 text-sm"
        />
        <button
          disabled={isPending || name.trim().length === 0}
          className="h-11 rounded-lg bg-[var(--clay-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
