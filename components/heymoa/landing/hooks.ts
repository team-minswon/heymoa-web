import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DependencyList,
  type UIEvent,
} from "react";

export function useOnceInView<T extends HTMLElement>({
  threshold = 0.4,
  rootMargin = "-64px 0px",
}: { threshold?: number; rootMargin?: string } = {}) {
  const [seen, setSeen] = useState(false);
  const attach = useCallback(
    (el: T | null) => {
      if (!el) return;
      if (typeof IntersectionObserver === "undefined") {
        setSeen(true);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry?.isIntersecting || entry.intersectionRatio < threshold - 0.01) return;
          setSeen(true);
          io.disconnect();
        },
        { threshold, rootMargin }
      );
      io.observe(el);
      return () => io.disconnect();
    },
    [threshold, rootMargin]
  );
  return [attach, seen] as const;
}

export function useFollowBottom(deps: DependencyList, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  useEffect(() => {
    if (!enabled || !following.current) return;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return [ref, onScroll] as const;
}

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduce(onChange: () => void) {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false
  );
}
