import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LandingClient } from "@/components/heymoa/landing-client";
import { listWorkspaces } from "@/lib/api/generated/workspace/workspace";
import { getCurrentUserForSsr } from "@/lib/auth/server";

export default async function Home() {
  const user = await getCurrentUserForSsr();

  if (user) {
    try {
      const headersList = await headers();
      const cookie = headersList.get("cookie");

      const workspaceResponse = await listWorkspaces({
        headers: { cookie: cookie || "" },
      });

      if (workspaceResponse.status === 200 && workspaceResponse.data.success) {
        const workspaces = workspaceResponse.data.data.items;
        const workspaceId =
          workspaces.find((workspace) => workspace.isDefault)?.workspaceId ??
          workspaces[0]?.workspaceId;
        if (workspaceId) {
          redirect(`/w/${workspaceId}`);
        }
      }
    } catch (e) {
      // Ignore API errors, simply fall back to landing page if default workspace cannot be resolved
    }
  }

  return <LandingClient />;
}
