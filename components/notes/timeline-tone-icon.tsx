import { ROLE_COLOR } from "@/components/notes/review/role-dot";
import type { TimelineTone } from "@/lib/notes/proposals/timeline";

/**
 * 유형의 모양 — 결정은 채운 체크, 할 일은 빈 원, 열린 질문은 점선 원, 답한 질문은 회색 체크, 참고는 작은
 * 점이다. 타임라인 · 검토 화면 · 랜딩 시연이 같은 모양을 쓴다. 랜딩이 타임라인 화면 모듈 전체를 끌어오지
 * 않게 따로 둔다.
 */
const TONE_ICON: Record<
  TimelineTone,
  { r: number; fill: string; stroke: string; dash?: string; check?: string }
> = {
  decision: {
    r: 6.25,
    fill: ROLE_COLOR.DECISION,
    stroke: ROLE_COLOR.DECISION,
    check: "#ffffff",
  },
  task: { r: 6, fill: "#ffffff", stroke: ROLE_COLOR.ACTION },
  open: { r: 6, fill: "#ffffff", stroke: ROLE_COLOR.OPEN, dash: "2.4 2.1" },
  answered: {
    r: 6,
    fill: "#ffffff",
    stroke: "var(--el-hairline-strong)",
    check: ROLE_COLOR.REFERENCE,
  },
  reference: { r: 3, fill: "var(--el-hairline-strong)", stroke: "none" },
};

export function TimelineToneIcon({
  tone,
  retracted = false,
}: {
  tone: TimelineTone;
  retracted?: boolean;
}) {
  const icon = TONE_ICON[retracted ? "reference" : tone];
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle
        cx="8"
        cy="8"
        r={icon.r}
        fill={icon.fill}
        stroke={icon.stroke}
        strokeWidth="1.5"
        strokeDasharray={icon.dash}
      />
      {icon.check ? (
        <path
          d="M5.4 8.2 7.2 10l3.4-3.8"
          stroke={icon.check}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

