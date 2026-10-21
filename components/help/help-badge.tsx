import { Badge } from "@/components/ui/badge";
import type { HelpBadgeName } from "@/app/[lang]/help/_content/types";
import { cn } from "@/lib/utils";

/** 보이는 글은 짧게, 스크린리더에는 뜻을 풀어 읽어 준다. */
const SPOKEN: Record<HelpBadgeName, string> = { 데스크톱: "데스크톱 앱 전용" };

/**
 * 라벨 옆 작은 회색 알약(기존 `Badge` 를 그대로 쓴다). 라벨과 같은 줄에 들어가게 `shrink-0` · 한 줄이고, 굵기는 보통이다.
 * 목록에서 선택된 항목(`aria-current="page"`, 배경이 이미 같은 회색)에서는 흰 알약으로 바꿔 대비를 지킨다.
 */
export function HelpBadge({
  name,
  className,
}: {
  name: HelpBadgeName;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-[18px] shrink-0 rounded-full bg-[var(--el-surface-strong)] px-2 text-[11px] leading-none font-normal text-[var(--tv-body)] group-aria-[current=page]/item:bg-white",
        className
      )}
    >
      <span aria-hidden>{name}</span>
      <span className="sr-only">{SPOKEN[name]}</span>
    </Badge>
  );
}
