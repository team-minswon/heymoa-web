"use client";

import { AlertTriangle } from "lucide-react";

/**
 * **소리는 남고 있는데 글자만 멈췄다** (APP-416).
 *
 * 받아쓰기 업체 소켓이 끊기면 자막이 멈춘다. 화면만 보면 녹음이 고장난 것과 구분되지 않아서,
 * 안 알리면 사용자가 **멀쩡한 녹음을 중단한다.** 서버만 아는 사실이라 서버가 말해 준다.
 *
 * 막지 않는다 — 알림 한 줄이고 버튼이 없다. 할 일이 없기 때문이다. 회복하면 사라진다.
 */
export function RecordingDegradedNotice() {
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--el-hairline)] bg-[color-mix(in_srgb,white_96%,transparent)] px-3 py-1.5 text-[13px] text-[var(--el-ink)] shadow-e2 backdrop-blur-xl"
    >
      <AlertTriangle className="size-4 shrink-0 text-amber-600" />
      <span>
        받아쓰기가 잠깐 멈췄습니다.{" "}
        <span className="text-[var(--el-muted)]">
          소리는 그대로 저장되고 있습니다.
        </span>
      </span>
    </div>
  );
}
