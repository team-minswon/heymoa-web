import { cn } from "@/lib/utils";

/**
 * 시각을 말하는 가로줄. 스레드 날짜 구분선과 기록 목록의 날짜 머리글이 같이 쓴다.
 * `align="start"` 는 목록 머리글 쪽이다.
 */
export function TimeRule({
  label,
  align = "center",
  ...props
}: {
  label: string;
  align?: "center" | "start";
} & React.ComponentProps<"div">) {
  return (
    <div {...props} className={cn("flex items-center gap-3", props.className)}>
      <span
        className={cn(
          "h-px bg-[var(--el-hairline)]",
          align === "center" ? "flex-1" : "w-4 shrink-0"
        )}
      />
      <span className="shrink-0 text-[11px] text-[var(--el-muted)]">
        {label}
      </span>
      <span className="h-px flex-1 bg-[var(--el-hairline)]" />
    </div>
  );
}
