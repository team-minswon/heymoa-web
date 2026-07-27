"use client";

import { ArrowDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 스크롤 영역 하단 중앙에 뜨는 "맨 아래로" 버튼. `ScrollArea`의 `overlay` 슬롯에 넣는다
 * (그 Root가 이미 `relative`다).
 *
 * 전사 뷰가 먼저 쓰던 형태를 챗봇 둘이 함께 쓰도록 꺼냈다. 세 곳이 같은 문제(위를 읽다가
 * 바닥으로 돌아가기)를 푸는데 생김새가 갈리면 같은 동작으로 안 읽힌다.
 *
 * **아이콘 하나다.** 문구를 넣으면 세 곳이 각자 다른 말을 쓰게 되고(실제로 전사는
 * `최신 기록 보기`, 챗봇은 `맨 아래로`였다) 좁은 폭에서는 읽는 면을 그만큼 더 가린다.
 * 아래 화살표 하나면 뜻이 서고, `label`은 사라지지 않고 접근성 이름으로 남는다.
 *
 * 감싸는 층이 `pointer-events-none`인 이유는 이 오버레이가 스크롤 영역 위를 덮기 때문이다 —
 * 버튼만 클릭을 받는다.
 */
export function ScrollToBottomButton({
  label,
  onClick,
  className,
}: {
  /** 화면에는 안 보이고 접근성 이름이 된다. */
  label: string;
  onClick: () => void;
  /** 하단 offset 조정용. 컴포저 위로 띄워야 하는 화면이 있다. */
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center",
        className
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label={label}
        // 플로팅은 e2 부양이다(ELEVATION SPEC). 단일 티어는 흰 마케팅 면 전용이라
        // 제품 캔버스에서 뭉개진다.
        className="pointer-events-auto rounded-full bg-white/95 shadow-e2 backdrop-blur-xl"
        onClick={onClick}
      >
        <ArrowDown className="size-4" />
      </Button>
    </div>
  );
}
