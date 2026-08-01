import { HydrationBoundary } from "@tanstack/react-query";

import { InboxPage } from "@/components/notification/inbox-page";
import { prefetchInbox } from "@/lib/workspace/prefetch";

export default async function InboxRoute() {
  const state = await prefetchInbox();

  return (
    <HydrationBoundary state={state}>
      <InboxPage />
    </HydrationBoundary>
  );
}
