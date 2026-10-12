import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 앞의 몇 개만 세운 목록의 「더 불러오기 · 접기」. 보이는 글자가 섹션마다 같아서, 화면 읽기 프로그램에는
 * `subject`(「결정」 등)를 붙인 이름을 준다 — 버튼 목록에서 어느 섹션인지 갈리게.
 */
export function ShowMoreButton({
  open,
  moreLabel,
  subject,
  onToggle,
  className,
}: {
  open: boolean;
  moreLabel: string;
  /** 무엇을 펼치고 접나 — 접근 가능한 이름에만 붙는다 */
  subject?: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={subject ? `${subject} ${open ? "접기" : moreLabel}` : undefined}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1 text-[12.5px] text-[var(--el-muted)] hover:text-[var(--el-ink)]",
        className
      )}
    >
      <ChevronDown
        aria-hidden
        className={cn(
          "size-[13px] transition-transform duration-200 ease-out motion-reduce:transition-none",
          open && "rotate-180"
        )}
      />
      {open ? "접기" : moreLabel}
    </button>
  );
}
