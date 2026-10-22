import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * 설정 탭들이 실제 화면과 로딩 skeleton 에서 **같이** 쓰는 뼈대(APP-1350).
 *
 * skeleton 이 실제의 클래스를 베껴 적으면 실제만 고칠 때 조용히 어긋난다 — 머리글을 `h-9` 막대로 덮었다가
 * 68 대 36 으로 밀린 적이 있다(rule `error-loading`). 여기 있는 것은 실제와 skeleton 이 같은 값을 읽는 자리다.
 */

/**
 * 탭 머리글. 제목·설명은 응답이 아니라 고정 문구라 skeleton 에서도 그대로 그린다. `action` 은 오른쪽 위 버튼 자리
 * (「새 연결」).
 */
export function SettingsHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const heading = (
    <>
      <h2 className="flex items-center gap-1.5 text-3xl font-light tracking-[-0.03em] text-[var(--el-ink)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm text-[var(--el-muted)]">{description}</p>
      ) : null}
    </>
  );
  return action ? (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>{heading}</div>
      {action}
    </header>
  ) : (
    <header className="mb-8">{heading}</header>
  );
}

/** 사람 한 줄씩 늘어선 목록(멤버·대기 중인 초대·임시 참여자)의 틀과 행. */
export const SETTINGS_LIST =
  "divide-y divide-[var(--el-hairline)] overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-white";
export const SETTINGS_LIST_ROW =
  "flex min-h-[52px] items-center gap-3 px-4 py-2.5";

/** 아이콘 칸 + 이름·보조 줄 + 오른쪽 버튼으로 된 카드(연동·MCP 연결). */
export const SETTINGS_CARD =
  "rounded-panel border border-[var(--el-hairline)] bg-white p-4";
/** 카드 왼쪽의 아이콘 칸. 색만 상태로 바뀐다. */
export const SETTINGS_CARD_ICON =
  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control";

/**
 * 글 한 줄 자리의 막대. **줄 높이를 그대로 잡고** 안에 막대만 세운다 — 막대 높이로 줄을 대신하면 글자 줄(20·16)과
 * 어긋난다. `xs` 는 `text-xs`(16), `sm` 은 `text-sm`(20) 한 줄이다.
 */
export function SkeletonLine({
  size = "sm",
  className,
}: {
  size?: "sm" | "xs";
  className?: string;
}) {
  return (
    <span className={cn("flex items-center", size === "sm" ? "h-5" : "h-4")}>
      <Skeleton
        className={cn(size === "sm" ? "h-3.5" : "h-3", "w-24", className)}
      />
    </span>
  );
}

/** 카드 왼쪽 아이콘 칸 자리. */
export function SkeletonCardIcon() {
  return <Skeleton className={cn(SETTINGS_CARD_ICON, "rounded-control")} />;
}
