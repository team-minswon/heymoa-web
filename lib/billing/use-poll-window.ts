import { useEffect, useState } from "react";

/** 자동 다시 읽기를 이어 갈 시간. HeyMoa 의 화면 정책이고 PG 완료 제한이 아니다(서버 작업은 이 화면과 무관하게 계속된다). */
const POLL_WINDOW_MS = 2 * 60_000;

/**
 * 마운트(또는 `restart()`)부터 2분이 지나면 `expired`. 쿼리의 `refetchInterval` 이 이 값으로 자동 반복을 멈추고, 화면은
 * 「다시 확인」을 보여 준다. `restart()` 는 새 2분을 연다.
 */
export function usePollWindow() {
  const [epoch, setEpoch] = useState(0);
  const [expiredEpoch, setExpiredEpoch] = useState<number | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setExpiredEpoch(epoch), POLL_WINDOW_MS);
    return () => clearTimeout(id);
  }, [epoch]);
  return {
    expired: expiredEpoch === epoch,
    restart: () => setEpoch((value) => value + 1),
  };
}

/** 첫 조회 뒤 2초, 그 뒤 5초. 서버가 `pollAfterSeconds` 를 주면 그것을 우선한다. */
export function nextPollDelay(
  pollAfterSeconds: number | null | undefined,
  dataUpdateCount: number
) {
  if (pollAfterSeconds != null) return pollAfterSeconds * 1000;
  return dataUpdateCount <= 1 ? 2000 : 5000;
}
