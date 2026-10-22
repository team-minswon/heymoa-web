import { mockDb } from "@/lib/mocks/db";

/**
 * 목 이벤트 스트림(`GET /v1/events`)으로 나갈 힌트의 버스(PRO-67 I04). 실서버가 커밋 뒤 내는 힌트를 목의 변경 자리에서 낸다 —
 * 스트림이 건강하면 web 이 목록을 폴링하지 않으므로, 힌트가 없으면 목 화면이 따라오지 않는다.
 */
type Listener = (event: string, data: unknown) => void;
const listeners = new Set<Listener>();

export function onMockUserEvent(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function emitMockUserEvent(event: string, data: unknown) {
  for (const listener of [...listeners]) listener(event, data);
}

/** 채팅 목록이 바뀌었다. 목은 대화의 워크스페이스를 따로 들지 않아 모든 워크스페이스에 낸다(web 은 그 목록만 다시 읽는다). */
export function emitChatsChanged() {
  for (const { workspaceId } of mockDb.listWorkspaces())
    emitMockUserEvent("chats.changed", { workspaceId });
}
