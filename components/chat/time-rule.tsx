import { cn } from "@/lib/utils";

/**
 * 시각을 말하는 가로줄. **스레드의 날짜 구분선과 기록 목록의 날짜 묶음 머리글이 이것 하나를
 * 같이 쓴다** — 두 곳이 다른 모양이면 같은 화면에서 따로 논다.
 *
 * `align="start"`는 목록 쪽이다. 묶음 머리글은 아래 줄들을 이끄는 자리라 왼쪽에 붙고,
 * 스레드 구분선은 위아래를 가르는 자리라 가운데 선다.
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
