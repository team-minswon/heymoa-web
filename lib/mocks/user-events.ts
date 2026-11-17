import { mockDb } from "@/lib/mocks/db";

type Listener = (event: string, data: unknown) => void;
const listeners = new Set<Listener>();

export function onMockUserEvent(listener: Listener) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function emitMockUserEvent(event: string, data: unknown) {
  for (const listener of [...listeners]) listener(event, data);
}

export function emitChatsChanged() {
  for (const { workspaceId } of mockDb.listWorkspaces())
    emitMockUserEvent("chats.changed", { workspaceId });
}

export function emitNotificationsChanged() {
  emitMockUserEvent("notifications.changed", {});
}

export function mockNotificationArrives() {
  const item = mockDb.arriveNotification();
  emitNotificationsChanged();
  return item;
}
