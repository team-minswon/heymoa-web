import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 외부 에이전트에 워크스페이스를 맡길 때 알리는 것. 설정의 새 연결(APP-804)과 OAuth 동의 화면(APP-888)이
 * 같은 문구를 쓴다 — PRD 「정한 것」 1·4·5: 범위는 워크스페이스 전체이고, 회의 전사도 읽히며, 이 연결은
 * 아무것도 바꾸지 않는다.
 */
export function AgentAccessNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-block bg-[var(--el-canvas-soft)] p-3.5 text-left text-xs break-keep",
        className
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
      <ul className="space-y-1 leading-relaxed text-[var(--el-muted)]">
        <li>
          이 워크스페이스의 프로젝트 전체가 열립니다. 연결한 뒤 생기는
          프로젝트도 포함됩니다.
        </li>
        {/* 게스트를 포함한 다른 참석자의 말이 내가 고른 외부 AI 로 간다 — 알고 맡기게 한다(APP-844) */}
        <li>회의 전사(참석자의 발화와 이름)도 이 앱이 읽습니다.</li>
        <li>
          앱은 읽기와 화면 열기만 하고 아무것도 바꾸지 않습니다. 내가 볼
          수 없는 것은 앱도 볼 수 없습니다.
        </li>
        <li>90일 동안 쓰지 않으면 저절로 만료됩니다.</li>
      </ul>
    </div>
  );
}
