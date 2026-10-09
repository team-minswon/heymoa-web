/**
 * 전사·타임라인이 「새 내용을 따라갈지」 정하는 규칙. 두 화면이 같이 쓴다.
 *
 * 예전에는 scroll 이벤트마다 「바닥에서 180px 안이면 따라간다」로 다시 재서, 휠로 180px 미만만
 * 올려도 따라가기가 그대로 켜져 있었고 다음 발화가 바닥으로 되돌렸다. 지금은 **사용자가 위로
 * 움직인 것이 확인되면 끄고, 스스로 바닥 근처까지 내려와야 다시 켠다.**
 */

/** 바닥에서 이만큼 안쪽이면 바닥으로 본다(스크롤 위치는 소수점). 따라가는 중에만 쓴다. */
export const FOLLOW_STICK_PX = 48;

/** 떠난 뒤 다시 붙는 폭. 붙어 있을 때보다 좁아야 30px 올린 직후 도로 붙지 않는다. */
export const FOLLOW_REARM_PX = 24;

/**
 * 따라가는 중에 이만큼 멀어지면 방향과 상관없이 떠난 것으로 본다. 검색·인용 이동처럼 코드가
 * 아래쪽 먼 곳으로 옮긴 경우이고, 한 틱에 자라는 높이보다는 크다.
 */
const LOST_PX = 180;

/** 내용이 줄어 브라우저가 `scrollTop` 을 끌어내린 것과 사람이 올린 것을 가르는 폭. */
const MOVED_AWAY_PX = 8;

const UP_KEYS = new Set(["PageUp", "Home", "ArrowUp"]);

export function distanceFromBottom(viewport: HTMLElement) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
}

/**
 * scroll 이벤트 한 번으로 따라갈지 다시 정한다.
 *
 * @param previousTop 직전 scroll 이벤트의 `scrollTop`. 처음이면 null — 방향을 모르니 거리로만 잰다.
 */
export function nextFollowing({
  following,
  top,
  previousTop,
  distance,
}: {
  following: boolean;
  top: number;
  previousTop: number | null;
  distance: number;
}) {
  if (previousTop === null) return distance <= FOLLOW_STICK_PX;
  const movedUp = top < previousTop;
  // 따라가는 중에는 내용이 자라 멀어진 거리로는 안 끈다(자람은 scroll 이벤트를 안 낸다).
  // 위로 움직였고 바닥에서 실제로 떨어졌을 때만 끈다.
  if (following) {
    return distance <= LOST_PX && !(movedUp && distance > MOVED_AWAY_PX);
  }
  // 떠나 있으면 내려오는 방향으로 바닥 가까이 왔을 때만 다시 켠다.
  return !movedUp && distance <= FOLLOW_REARM_PX;
}

/**
 * 위로 가는 손짓(휠·터치·키)을 듣는다. scroll 은 비동기라 그 사이 자동 스크롤이 먼저 돌아
 * 바닥으로 되돌리므로, 입력 시점에 동기로 끊어야 한다. 해제 함수를 돌려준다.
 */
export function watchUpwardInput(viewport: HTMLElement, onUp: () => void) {
  let touchStartY = 0;
  const onWheel = (event: WheelEvent) => {
    // ctrl+휠은 확대·축소라 스크롤이 아니다.
    if (event.deltaY < 0 && !event.ctrlKey) onUp();
  };
  const onTouchStart = (event: TouchEvent) => {
    touchStartY = event.touches[0]?.clientY ?? 0;
  };
  const onTouchMove = (event: TouchEvent) => {
    // 손가락이 아래로 = 내용이 위로 = 앞부분을 보러 간다.
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
