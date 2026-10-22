import { NoteRouteClient } from "@/components/notes/note-route-client";

export default async function NoteRoute({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; noteId: string }>;
  searchParams: Promise<{
    view?: string | string[];
    tab?: string | string[];
    utm_medium?: string | string[];
    source?: string | string[];
  }>;
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
        // 메일 링크로 들어왔나(APP-1312). **서버가 받은 주소로 판정한다** — 클라이언트 코드가 주소를
        // 고치기 전이다. 메일의 앱 링크에는 서버가 `utm_medium=email` 을 붙인다(PRO-67 contract).
        ...([query.utm_medium].flat().includes("email")
          ? { source: "mail" as const }
          : // 알림 모달의 행에서 왔다(PRO-67 I09). 노트가 「알림 목록으로」를 세우고 진입을 센다.
            [query.source].flat().includes("notification")
            ? { source: "notification" as const }
            : {}),
      }}
    />
  );
}
