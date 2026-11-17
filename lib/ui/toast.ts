import { toast as manager } from "@/components/ui/toast";

type ToastOptions = {
  id?: string;
  duration?: number;
  description?: string;
  action?: { label: string; onClick: () => void };
};

/** `Infinity` 는 base-ui 에서 `timeout: 0`(자동 닫힘 없음)입니다. */
function timeoutOf(duration: number | undefined) {
  if (duration === undefined) return undefined;
  return Number.isFinite(duration) ? duration : 0;
}

function show(
  type: "success" | "error" | "info",
  message: string,
  options?: ToastOptions
) {
  return manager.add({
    title: message,
    type,
    id: options?.id,
    timeout: timeoutOf(options?.duration),
    description: options?.description,
    // base-ui 는 액션을 `actionProps`(버튼 props)로 받습니다. 라벨은 children 입니다.
    actionProps: options?.action
      ? { children: options.action.label, onClick: options.action.onClick }
      : undefined,
  });
}

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    show("success", message, options),
  error: (message: string, options?: ToastOptions) =>
    show("error", message, options),
  info: (message: string, options?: ToastOptions) =>
    show("info", message, options),
  dismiss: (id?: string) => manager.close(id),
};
