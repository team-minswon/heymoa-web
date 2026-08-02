import { toast as manager } from "@/components/ui/toast";

type ToastOptions = {
  /** 같은 id로 다시 부르면 새 토스트를 쌓지 않고 그 자리를 갱신한다. */
  id?: string;
  /** ms. `Infinity`면 사용자가 닫을 때까지 남는다. */
  duration?: number;
  /** 제목 아래 한 줄. 무엇을 하라는 안내에 쓴다. */
  description?: string;
  /** 되돌리거나 다시 시도할 수단. 없으면 버튼이 안 그려진다. */
  action?: { label: string; onClick: () => void };
};

/** `Infinity`는 base-ui에서 `timeout: 0`(자동 닫힘 없음)이다. */
function timeoutOf(duration: number | undefined) {
  if (duration === undefined) return undefined;
  return Number.isFinite(duration) ? duration : 0;
}

function show(
  type: "success" | "error",
  message: string,
  options?: ToastOptions
) {
  return manager.add({
    title: message,
    type,
    id: options?.id,
    timeout: timeoutOf(options?.duration),
    description: options?.description,
    // base-ui는 액션을 `actionProps`(버튼 props)로 받는다 — 라벨은 children이다.
    actionProps: options?.action
      ? { children: options.action.label, onClick: options.action.onClick }
      : undefined,
  });
}

/**
 * 제품 코드가 쓰는 토스트 표면. base-ui `Toast` 매니저를 감싼 얇은 층이다.
 *
 * 왜 감싸나 — 호출부가 30곳이 넘고 전부 `toast.error(문구, { id })` 한 줄이다. 매니저의
 * `add({ title, type, id, timeout })`를 그대로 쓰게 하면 그 30곳이 각자 옵션 객체를 조립하고,
 * `Infinity → timeout: 0` 같은 변환도 곳곳에서 다시 틀린다. 표면은 여기 한 곳에 둔다.
 *
 * 토스트가 **어디에 뜨는지**는 `components/ui/toast.tsx`의 뷰포트가 정한다(우측 상단).
 */
export const toast = {
  success: (message: string, options?: ToastOptions) =>
    show("success", message, options),
  error: (message: string, options?: ToastOptions) =>
    show("error", message, options),
  /** id를 주면 그 토스트만, 없으면 전부 닫는다. */
  dismiss: (id?: string) => manager.close(id),
};
