/**
 * 카드 변경 모달(APP-1600)의 부모·자식 통신. 모달은 분석이 실린 설정 창 문서 위의 층이고, 카드 칸·동의는 그 안 iframe 에 실린
 * 분석 없는 문서(`/billing/card-change/{workspaceId}`)에만 있다. 둘은 같은 출처라 `postMessage` 로 높이·진행·결과만 주고받는다.
 * **카드 값과 동의 상태는 메시지에 싣지 않는다.**
 */
export const CARD_ENTRY_MESSAGE = "heymoa:card-entry";

type CardEntryEvent =
  | { event: "height"; height: number }
  /** 제출 중에는 모달을 닫지 못하게 한다. */
  | { event: "submitting"; submitting: boolean }
  /** iframe 에 포커스가 있으면 Esc 가 부모 문서로 가지 않는다 — 자식이 대신 알린다. */
  | { event: "escape" }
  /** 카드 변경이 끝났다 — 모달을 닫고 결제 관리를 새로 읽어 알린다. */
  | { event: "changed" }
  /** 결과를 이 자리에서 못 정했다(409·결과 불명·오래 걸림) — 결과 화면이 읽는다. */
  | { event: "result"; setupId: string };

export const cardChangeFramePath = (workspaceId: string) =>
  `/billing/card-change/${workspaceId}`;

/** 자식(iframe 안 문서)이 부모에게. 받는 출처를 우리 출처로 못박는다. */
export function postToCardEntryParent(message: CardEntryEvent) {
  window.parent.postMessage(
    { type: CARD_ENTRY_MESSAGE, ...message },
    window.location.origin
  );
}

/** 부모가 받은 메시지 중 우리 출처·그 iframe 이 보낸 것만 읽는다. */
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

/**
 * iframe 이 첫 높이를 알리기 전 모달이 그리는 자리. 1440·1024 에서 잰 카드 변경 문서 높이다(카드가 있을 때 · 없을 때).
 * shortcut: 문구·칸이 바뀌면 다시 재야 한다(어긋나면 문서가 도착할 때 그만큼 튄다).
 */
export const cardChangeFrameSkeleton = (register: boolean) =>
  register
    ? "h-[590px] w-full rounded-panel"
    : "h-[648px] w-full rounded-panel";
