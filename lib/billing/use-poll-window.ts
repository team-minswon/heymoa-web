import { useEffect, useState } from "react";

const POLL_WINDOW_MS = 3 * 60_000;

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

export function nextPollDelay(
  pollAfterSeconds: number | null | undefined,
  dataUpdateCount: number
) {
  if (pollAfterSeconds != null) return pollAfterSeconds * 1000;
  return dataUpdateCount <= 1 ? 2000 : 5000;
}
