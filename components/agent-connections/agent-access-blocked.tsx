import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";

/** 외부 에이전트를 끈 워크스페이스로 발급·허락하면 server 가 주는 403 코드(APP-939). */
export const AGENT_ACCESS_DISABLED = "AGENT_ACCESS_DISABLED";

/** 막힌 워크스페이스도 선택 상자에 남기고 이름 뒤에 붙인다 — 빼면 내 워크스페이스가 왜 없는지 모른다(APP-941). */
export const BLOCKED_SUFFIX = " (외부 에이전트 꺼짐)";

/**
 * 고른 워크스페이스가 외부 에이전트를 막아 두었다(APP-941). 개인 토큰 폼과 동의 화면이 같이 쓴다 —
 * 관리자가 다시 켜기 전까지 계속 참인 상태라 토스트가 아니라 인라인이다.
 *
 * 「다시 확인」은 워크스페이스를 다시 읽는다. 앱은 창 포커스에 다시 읽지 않아, 열어 둔 채 관리자가 켜면
 * 이것 말고는 잠금이 풀리지 않는다.
 */
export function AgentAccessBlockedNotice({
  onRecheck,
  rechecking,
}: {
  onRecheck: () => void;
  rechecking: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] p-3.5 text-left"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-[var(--el-muted)]">
          관리자가 이 워크스페이스의 외부 에이전트 연결을 꺼 두었습니다.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-[30px]"
          loading={rechecking}
          disabled={rechecking}
          onClick={onRecheck}
        >
          다시 확인
        </Button>
      </div>
    </div>
  );
}
