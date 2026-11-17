export const FOLLOW_STICK_PX = 48;

export const FOLLOW_REARM_PX = 24;

const LOST_PX = 180;

/** 내용이 줄어 브라우저가 `scrollTop` 을 끌어내린 것과 사람이 올린 것을 가르는 폭입니다. */
const MOVED_AWAY_PX = 8;

const UP_KEYS = new Set(["PageUp", "Home", "ArrowUp"]);

export function distanceFromBottom(viewport: HTMLElement) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
}

export function nextFollowing({
  following,
  top,
  previousTop,
  distance,
  contentGrew = false,
}: {
  following: boolean;
  top: number;
  previousTop: number | null;
  distance: number;
  contentGrew?: boolean;
}) {
  if (previousTop === null) return distance <= FOLLOW_STICK_PX;
  const movedUp = top < previousTop;
  if (following) {
    return (
      (contentGrew || distance <= LOST_PX) &&
      !(movedUp && distance > MOVED_AWAY_PX)
    );
  }
  return !movedUp && distance <= FOLLOW_REARM_PX;
}

/** scroll 이벤트는 비동기라 그 사이 자동 스크롤이 바닥으로 되돌리므로, 위로 가는 입력 시점에 동기로 끊습니다. */
export function watchUpwardInput(viewport: HTMLElement, onUp: () => void) {
  let touchStartY = 0;
  const onWheel = (event: WheelEvent) => {
    // ctrl+휠은 브라우저 확대·축소라 스크롤이 아닙니다.
    if (event.deltaY < 0 && !event.ctrlKey) onUp();
  };
  const onTouchStart = (event: TouchEvent) => {
    touchStartY = event.touches[0]?.clientY ?? 0;
  };
  const onTouchMove = (event: TouchEvent) => {
    const y = event.touches[0]?.clientY ?? 0;
    if (y > touchStartY) onUp();
    touchStartY = y;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (UP_KEYS.has(event.key)) onUp();
  };
  viewport.addEventListener("wheel", onWheel, { passive: true });
  viewport.addEventListener("touchstart", onTouchStart, { passive: true });
  viewport.addEventListener("touchmove", onTouchMove, { passive: true });
  viewport.addEventListener("keydown", onKeyDown);
  return () => {
    viewport.removeEventListener("wheel", onWheel);
    viewport.removeEventListener("touchstart", onTouchStart);
    viewport.removeEventListener("touchmove", onTouchMove);
    viewport.removeEventListener("keydown", onKeyDown);
  };
}
