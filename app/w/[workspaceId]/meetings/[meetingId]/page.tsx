import { HydrationBoundary } from "@tanstack/react-query";

import { NoteRouteClient } from "@/components/notes/note-route-client";
import { prefetchNoteRoute } from "@/lib/workspace/prefetch";

/**
 * 주소는 `meetings/{meetingId}` 지만 계약 엔티티는 note 다. 서버가 `/v1/notes/{noteId}` 를
 * 주는 한 코드 어휘는 note 로 두고, 사람이 읽는 자리(주소·문구)만 회의로 부른다.
 */
export default async function MeetingRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; meetingId: string }>;
  searchParams: Promise<{ view?: string | string[]; tab?: string | string[] }>;
}) {
  const [{ workspaceId, meetingId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const state = await prefetchNoteRoute({ workspaceId, noteId: meetingId });

  return (
    <HydrationBoundary state={state}>
      <NoteRouteClient
        workspaceId={workspaceId}
        noteId={meetingId}
        initialQuery={{
          view: Array.isArray(query.view) ? query.view[0] : query.view,
          tab: Array.isArray(query.tab) ? query.tab[0] : query.tab,
        }}
      />
    </HydrationBoundary>
  );
}
