import { FileQuestionMark } from "lucide-react";
import Link from "next/link";

/**
 * design.pen `TFJVM` — 제품 면의 404 는 **작게** 말한다. 34px 세리프 제목을 쓰면
 * 「없는 주소」가 페이지의 주제처럼 읽히는데, 여기서 할 일은 돌아갈 길을 주는 것뿐이다.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3.5 bg-[var(--el-canvas)] p-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-[var(--el-surface-strong)]">
        <FileQuestionMark className="size-5 text-[var(--el-muted)]" />
      </span>
      <p className="text-[15px] font-semibold text-[var(--el-ink)]">
        404 · 없는 주소입니다
      </p>
      <p className="max-w-[420px] text-[13px] leading-[21px] text-[var(--el-body)]">
        주소가 바뀌었거나 회의가 삭제됐을 수 있습니다. 워크스페이스가 다르면 같은
        링크라도 보이지 않습니다.
      </p>
      <Link
        href="/"
        className="mt-2.5 flex h-9 items-center rounded-control bg-[var(--el-primary)] px-3.5 text-[13px] font-medium text-[var(--el-on-primary)]"
      >
        홈으로
      </Link>
    </div>
  );
}
