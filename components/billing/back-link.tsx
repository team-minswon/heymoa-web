import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/** 설정 탭 안에서 한 단계 들어간 화면(결제 상세)의 돌아가기. 머리글 위에 선다. */
export function BackLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-5 -ml-1 inline-flex h-7 items-center gap-1 rounded-control px-1 text-sm text-[var(--el-muted)] hover:text-[var(--el-ink)]"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </button>
  );
}
