import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { LandingClient } from "@/components/heymoa/landing-client";
import { getDefaultWorkspace } from "@/lib/api/generated/workspace/workspace";
import { getCurrentUserForSsr } from "@/lib/auth/server";

export default async function Home() {
  const user = await getCurrentUserForSsr();

  if (user) {
    try {
      const headersList = await headers();
      const cookie = headersList.get("cookie");
      
      const workspaceResponse = await getDefaultWorkspace({
        headers: { cookie: cookie || "" },
      });
      
      if (workspaceResponse.status === 200 && workspaceResponse.data.success) {
        const workspaceId = workspaceResponse.data.data?.workspaceId;
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
