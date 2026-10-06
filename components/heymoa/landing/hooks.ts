import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type DependencyList,
  type UIEvent,
} from "react";

/*
 * 클라이언트 컴포넌트만 import 한다. 그림의 색 규칙은 다른 파일과 같다 —
 * 창 안 = `--el-*` · `APP` · `ROLE_*`, 창 밖 · 창 위 주석 = `--tv-*`.
 */

/**
 * 화면에 **한 번** 들어왔나. 들어오면 관찰을 끊는다(장면은 한 번만 돈다). `IntersectionObserver` 가
 * 없으면 처음부터 참 — 정지 화면(끝 상태)이 선다.
 *
 * 배열로 돌려준다. 객체에 담아 `ref={x.attach}` 로 꺼내면 eslint 가 그 객체를 ref 로 보고 「렌더 중
 * ref 읽기」로 잡는다(`use-demo.ts` `useInView` 와 같은 이유).
 */
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
          // `isIntersecting` 은 조금만 걸쳐도 참이라 임계값을 따로 본다(반올림 오차만큼 봐준다).
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

/**
 * 바닥을 따라가는 스크롤(`product-shot.tsx` `useFollowBottom` 그대로). **읽으려고 위로 올린 사람을
 * 끌어내리지 않는다** — 따라갈 의도는 새 DOM 이 붙기 전에, 사용자의 스크롤 이벤트에서 읽어 둔다.
 * `scrollIntoView` 가 아니라 `scrollTop` 이다(숨은 쪽이 페이지를 끌고 가지 않게). smooth 금지.
 */
export function useFollowBottom(deps: DependencyList, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    // 24px 은 한 줄이 채 안 되는 여유다. 0 이면 관성 스크롤의 소수점 오차에 걸려 떨어진다.
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

/**
 * 모션 줄이기 설정. 서버와 첫 하이드레이션은 거짓이라 어긋나지 않고, 붙은 뒤 실제 값으로 바뀐다.
 * 설정을 바꾸면 따라 바뀐다.
 */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false
  );
}
