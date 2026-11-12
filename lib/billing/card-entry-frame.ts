/**
 * 카드 입력 모달(APP-1600)의 부모·자식 통신. 모달은 분석이 실린 앱 문서 위의 층이고, 카드 칸은 그 안 iframe 에 실린
 * 분석 없는 문서(`/billing/setups/{id}/card/embed`)에만 있다. 둘은 같은 출처라 `postMessage` 로 높이·진행만 주고받는다.
 * **카드 값은 메시지에 싣지 않는다.**
 */
export const CARD_ENTRY_MESSAGE = "heymoa:card-entry";

export type CardEntryEvent =
  | { event: "height"; height: number }
  /** 제출 중에는 모달을 닫지 못하게 한다. */
  | { event: "submitting"; submitting: boolean }
  /** iframe 에 포커스가 있으면 Esc 가 부모 문서로 가지 않는다 — 자식이 대신 알린다. */
  | { event: "escape" }
  /** 제출이 끝나 결과를 볼 차례(성공·결과 불명·409). */
  | { event: "done" }
  /** 등록이 더는 카드를 받지 않는다. */
  | { event: "closed-setup" };

export const cardEntryFramePath = (setupId: string) =>
  `/billing/setups/${setupId}/card/embed`;

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
 * iframe 이 첫 높이를 알리기 전 모달이 그리는 자리. 1440·1024 에서 잰 양식 높이다 — 첫 구매는 시험 결제 안내가 있어 더 높다.
 * shortcut: 문구·칸이 바뀌면 다시 재야 한다(어긋나면 양식이 도착할 때 그만큼 튄다).
 */
export const cardEntryFrameSkeleton = (replace: boolean) =>
  replace ? "h-[396px] w-full rounded-panel" : "h-[478px] w-full rounded-panel";
