"use client";

import { useState, type FormEvent } from "react";
import { updateOrganizationApi } from "@/lib/api/endpoints";

type OrganizationSettingsFormProps = {
  organizationPublicId: string;
  initialName: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function OrganizationSettingsForm({
  organizationPublicId,
  initialName,
}: OrganizationSettingsFormProps) {
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<SaveStatus>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");

    try {
      const organization = await updateOrganizationApi(organizationPublicId, {
        name,
      });

      setName(organization.name);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form
      className="mt-8 max-w-xl border border-border bg-muted p-5"
      onSubmit={handleSubmit}
    >
      <label className="text-sm font-medium" htmlFor="organization-name">
        Organization name
      </label>
      <input
        id="organization-name"
        className="mt-3 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
        maxLength={255}
        name="name"
        onChange={(event) => {
          setName(event.target.value);
          setStatus("idle");
        }}
        required
        value={name}
      />
      <div className="mt-4 flex items-center gap-3">
        <button
          className="border border-border bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
          disabled={status === "saving" || !name.trim()}
          type="submit"
        >
          {status === "saving" ? "Saving" : "Save changes"}
        </button>
        {status === "saved" ? (
          <p className="text-sm text-muted-foreground">Changes saved.</p>
        ) : null}
        {status === "error" ? (
          <p className="text-sm text-muted-foreground">
            Could not save changes.
          </p>
        ) : null}
      </div>
    </form>
  );
}
