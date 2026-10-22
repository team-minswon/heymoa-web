import { UserEventProvider } from "@/components/events/user-event-provider";

/**
 * 워크스페이스 면 공용 층. 워크스페이스를 바꿔도(`[workspaceId]` 가 바뀌어도) 다시 마운트되지 않아, 사용자 단위 이벤트
 * 스트림 연결이 탭 하나에 하나로 유지된다(PRO-67 I02). 로그인하지 않았으면 provider 가 연결하지 않는다.
 */
export default function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UserEventProvider>{children}</UserEventProvider>;
}
