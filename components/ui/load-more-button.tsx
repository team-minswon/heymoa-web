import { ChevronDown, Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 목록 끝의 「더 불러오기」. 문구는 그대로 두고 오른쪽 화살표 자리만 spinner 로 바꾼다 — 문구를 「불러오는 중」으로 갈면 폭이
 * 바뀌어 버튼이 출렁인다. 둘 다 같은 크기라 폭 · 높이가 같다.
 *
 * 화살표는 가리키거나 키보드로 닿았을 때 한 번 2px 내려앉고 떠나면 돌아온다. 계속 튀는 반복은 쓰지 않는다 — 목록 끝에 늘 떠 있는
 * 버튼이 혼자 움직이면 읽는 눈을 끈다. 움직임 줄이기 설정이면 움직이지 않는다.
 *
 * 불러오는 동안은 눌리지 않는다(같은 쪽을 두 번 읽지 않게). 화면 읽기 프로그램에는 `loadingLabel` 을 한 번 알린다.
 */
export function LoadMoreButton({
  loading,
  loadingLabel,
  children,
  className,
  variant = "outline",
  size = "sm",
  ...props
}: Omit<ButtonProps, "loading"> & { loading: boolean; loadingLabel: string }) {
  const Icon = loading ? Loader2 : ChevronDown;
  return (
    <>
      <Button
        variant={variant}
        size={size}
        aria-busy={loading || undefined}
        disabled={loading}
        className={cn(
          "group/more rounded-full disabled:opacity-100 disabled:text-[var(--el-muted)]",
          className
        )}
        {...props}
      >
        {children}
        <Icon
          aria-hidden
          data-icon="inline-end"
          className={cn(
            loading
              ? "animate-spin"
              : "transition-transform duration-200 ease-out group-hover/more:translate-y-0.5 group-focus-visible/more:translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/more:translate-y-0 motion-reduce:group-focus-visible/more:translate-y-0"
          )}
        />
      </Button>
      <span role="status" className="sr-only">
        {loading ? loadingLabel : ""}
      </span>
    </>
  );
}
