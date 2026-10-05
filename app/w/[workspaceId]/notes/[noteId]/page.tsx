import { NoteRouteClient } from "@/components/notes/note-route-client";

export default async function NoteRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; noteId: string }>;
  searchParams: Promise<{ view?: string | string[]; tab?: string | string[] }>;
}) {
  const [{ workspaceId, noteId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  // 화면부터 전환한다. 노트 조회는 클라이언트 캐시와 패널의 로딩 상태가 맡는다.

  return (
    <NoteRouteClient
      workspaceId={workspaceId}
      noteId={noteId}
      initialQuery={{
        view: Array.isArray(query.view) ? query.view[0] : query.view,
        tab: Array.isArray(query.tab) ? query.tab[0] : query.tab,
      }}
    />
  );
}
