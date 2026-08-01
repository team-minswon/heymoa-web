import { Info } from "lucide-react";

/**
 * ⚠ 계약 갭 — 알림 설정을 저장할 엔드포인트가 없다. `NotificationListResponse` 는 목록만 준다.
 *
 * 그래서 토글을 **켜지는 척하게 두지 않는다.** 조작 가능한 컨트롤을 놓고 저장이 안 되면
 * 사용자는 껐다고 믿고 계속 알림을 받는다 — 그게 아무것도 안 그리는 것보다 나쁘다.
 * 지금 실제로 오는 알림이 무엇인지 말하고, 끄는 건 아직 없다고 밝힌다.
 */
const CHANNELS = [
  {
    label: "워크스페이스 초대",
    detail: "초대를 받으면 인박스에 쌓입니다.",
  },
  {
    label: "회의 분석 완료",
    detail: "내가 시작한 회의의 요약이 준비되면 알립니다.",
  },
] as const;

export function NotificationsSettings() {
  return (
    <div className="grid gap-5">
      <p className="flex gap-2.5 rounded-block border border-[var(--el-hairline)] bg-[var(--el-canvas-soft)] px-4 py-3 text-[12px] leading-6 text-[var(--el-body)]">
        <Info className="mt-0.5 size-4 shrink-0 text-[var(--el-muted)]" />
        지금은 알림을 끄고 켤 수 없습니다. 저장할 곳이 서버에 아직 없어서 토글을
        두지 않았습니다 — 껐다고 믿게 만드는 쪽이 더 나쁩니다.
      </p>

      <ul className="overflow-hidden rounded-panel border border-[var(--el-hairline)] bg-card">
        {CHANNELS.map((channel) => (
          <li
            key={channel.label}
            className="flex items-center gap-4 border-b border-[var(--el-hairline)] px-4 py-3.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium">
                {channel.label}
              </span>
              <span className="mt-0.5 block text-[12px] text-[var(--el-muted)]">
                {channel.detail}
              </span>
            </span>
            <span className="shrink-0 rounded-chip bg-secondary px-2 py-1 text-[11px] font-medium text-[var(--el-body)]">
              받는 중
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
