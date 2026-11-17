export const CARD_ENTRY_MESSAGE = "heymoa:card-entry";

type CardEntryEvent =
  | { event: "height"; height: number }
  | { event: "submitting"; submitting: boolean }
  /** iframe 에 포커스가 있으면 Esc 가 부모 문서로 가지 않아 자식이 대신 알립니다. */
  | { event: "escape" }
  | { event: "changed" }
  | { event: "result"; setupId: string };

export const cardChangeFramePath = (workspaceId: string) =>
  `/billing/card-change/${workspaceId}`;

export function postToCardEntryParent(message: CardEntryEvent) {
  window.parent.postMessage(
    { type: CARD_ENTRY_MESSAGE, ...message },
    window.location.origin
  );
}

export function cardEntryEventOf(
  event: MessageEvent,
  frame: HTMLIFrameElement | null
): CardEntryEvent | null {
  if (event.origin !== window.location.origin) return null;
  if (!frame || event.source !== frame.contentWindow) return null;
  const data = event.data as { type?: unknown; event?: unknown } | null;
  if (!data || data.type !== CARD_ENTRY_MESSAGE) return null;
  return data as CardEntryEvent;
}

export const cardChangeFrameSkeleton = (register: boolean) =>
  register
    ? "h-[590px] w-full rounded-panel"
    : "h-[648px] w-full rounded-panel";
